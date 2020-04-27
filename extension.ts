// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as _ from 'lodash';

interface PhosphorRange {
	opacityIndex: number,
	range: vscode.Range,
	rangeLength: number,
	text: string
};

let activeEditor : vscode.TextEditor;
let phosphorOptions;
let queuedTimeout = false;
let phosphorRanges : Array<PhosphorRange> = [];
let opacities : Array<string> = [];
let phosphorDecorations;

export function enable() {
	initializeEditPhosphor();
	phosphorOptions.enabled = true;
}

export function disable() {
	phosphorOptions.enabled = false;
	phosphorRanges = [];
	phosphorDecorations.forEach((phosphorDecoration) => {
		if (activeEditor) {
			activeEditor.setDecorations(phosphorDecoration, []);
		}
	});
}

function dpRounder(number) {
	return Math.round( number * 100 ) / 100;
}

function smoothstep(x: number, xStart: number, yStart: number, xEnd: number, yEnd:number, yMax: number, yMin: number): number {
	function clamp(x: number, xMin: number, xMax: number): number {
		return x<xMin ? xMin : (x>xMax ? xMax : x)
	}

	x = clamp((x - xStart) / (xEnd - xStart), 0.0, 1.0)
	return clamp(yStart + (x * x * (3 - 2 * x) * (yEnd - yStart)), yMin, yMax)
}

function initializeEditPhosphor() {
	try {
		let phosphorOptionsOverrides = vscode.workspace.getConfiguration('editPhosphor');
		phosphorOptions = _.clone(phosphorOptionsOverrides);

		// TODO: If disabled, we should drop out after making sure settings are cleared.
		if (!phosphorOptions.enabled) {return;}

		opacities = [];
		let phosphorSmoothstep = phosphorOptions.smoothstep;
		if (phosphorSmoothstep) {
			let xStart = phosphorOptions.smoothstepXStart;
			let yStart = phosphorOptions.smoothstepYStart;
			let xEnd = phosphorOptions.smoothstepXEnd;
			let yEnd = phosphorOptions.smoothstepYEnd;
			let yMax = phosphorOptions.smoothstepYMax;
			let yMin = phosphorOptions.smoothstepYMin;
			let fadeStart = phosphorOptions.fadeStart;
			let fadeEnd = phosphorOptions.fadeEnd;
			let stepSize = 1/phosphorOptions.smoothSteps
			for (let step = 0; step < 1; step += stepSize) {
				let smoothstepOpacity = smoothstep(step, xStart, yStart, xEnd, yEnd, yMax, yMin);
				// y = mx + b
				// y = (fadeStart-fadeEnd)*x + fadeEnd
				// let opacity = dpRounder((fadeStart-fadeEnd) * smoothstepOpacity + fadeEnd);
				let opacity = (fadeStart-fadeEnd) * smoothstepOpacity + fadeEnd;
				//if (Math.abs(opacity - fadeEnd) < 1/256) {break;} // If there isn't any significant difference from the final value, this can end early
				opacities.push(opacity.toString());
			}
		} else {
			let phosphorFade = phosphorOptions.fadeStart;
			while (phosphorFade > phosphorOptions.fadeEnd) {
				opacities.push(phosphorFade.toString());
				phosphorFade = dpRounder(phosphorFade -= phosphorOptions.fadeStep);
			}
		}
		opacities.reverse();

		// Create the decorators
		let newPhosphorDecorations = [];
		for (let i = 0; i < opacities.length; ++i) {
			newPhosphorDecorations.push(
				vscode.window.createTextEditorDecorationType({
					light: {
						backgroundColor: 'rgba('+ (phosphorOptions.colorLight || phosphorOptions.color) + ',' + opacities[i] + ')'
					},
					dark: {
						backgroundColor: 'rgba('+ (phosphorOptions.colorDark || phosphorOptions.color) + ',' + opacities[i] + ')'
					}
				})
			);
		}
		phosphorDecorations = newPhosphorDecorations;
	} catch(err) {
		console.log(err);
	}
}

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('edit-phosphor is activated');
	initializeEditPhosphor();

	var commands = [
		vscode.commands.registerCommand('editPhosphor.enable', enable),
		vscode.commands.registerCommand('editPhosphor.disable', disable)
	];

	commands.forEach(function (command) {
		context.subscriptions.push(command);
	});

	activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		triggerUpdateDecorations();
	}

	// Register for Active Editor changes
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (activeEditor !== editor) {
			phosphorRanges = [];
		}

		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	// Register for Text Editor changes
	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document && phosphorOptions.enabled) {
			event.contentChanges.forEach((contentChange) => {
				try {
					// Ensure that the range covers the change
					if (0 === contentChange.rangeLength) {
                        contentChange = {
							range: new vscode.Range(contentChange.range.start, new vscode.Position(contentChange.range.end.line, contentChange.range.end.character + contentChange.text.length)),
							rangeOffset: contentChange.rangeOffset,
							rangeLength: contentChange.text.length,
                          	text: contentChange.text
						};
					}

					var phosphorRange: PhosphorRange = {
						opacityIndex: opacities.length - 1,
						range: contentChange.range,
						rangeLength: contentChange.rangeLength,
						text: contentChange.text
					};
					phosphorRanges.push(phosphorRange);

					// Create our animation logic
					var fn = function () {
						//phosphorRange.opacityIndex -= 1;
						triggerUpdateDecorations();

						if (0 <= phosphorRange.opacityIndex--) {
							setTimeout(fn, phosphorOptions.fadeMS + (Math.min(phosphorRange.rangeLength, 10)));
						}
					};
					setTimeout(fn, phosphorOptions.fadeMS);
				} catch (err) {
					console.log(err);
				}
			});

			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	// Use a timer to avoid overloading the system
	var timeout = null;
	function triggerUpdateDecorations() {
		if (!timeout) {
			queuedTimeout = false;
			timeout = setTimeout(updateDecorations, phosphorOptions.redrawFrequency);
		} else {
			queuedTimeout = true;
		}
	}

	// Update the decorations
	function updateDecorations() {
		try {
			if (!activeEditor) {
				return;
			}

			// Create placeholder arrays (for each opacity level)
			var prunedPhosphorRanges: Array<Array<PhosphorRange>> = [];
			for (var i = 0; i < opacities.length; ++i) {
				prunedPhosphorRanges.push([]);
			}

			// Sort the phosphorRanges into the correct array for their opacity level
			phosphorRanges.forEach((phosphorRange) => {
				if (0 <= phosphorRange.opacityIndex) {
					prunedPhosphorRanges[phosphorRange.opacityIndex].push(phosphorRange);
				}
			});

			// Add the ranges to the decorator
			prunedPhosphorRanges.forEach((phosphorRanges, index) => {
				var decorators: vscode.DecorationOptions[] = [];
				phosphorRanges.forEach((phosphorRange) => {
					var decoration = { range: phosphorRange.range, hoverMessage: phosphorRange.text };
					decorators.push(decoration);
				});

				if (null !== phosphorDecorations && index < phosphorDecorations.length) {
					activeEditor.setDecorations(phosphorDecorations[index], decorators);
				}
			});

			// Signal that we are done
			timeout = null;
			if (queuedTimeout) {
				triggerUpdateDecorations();
			}
		} catch (err) {
			console.log(err);
		}
	}

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('editPhosphor')) {
			timeout = null;
			queuedTimeout = false;
			console.log('Refreshing edit-phosphor configuration')
			initializeEditPhosphor();
		}
	}))
}
