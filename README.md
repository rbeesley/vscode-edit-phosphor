# VSCode Edit Phosphor Extension

## What is it

Inspired from the original [SnakeTrail](https://github.com/richie5um/vscode-snake-trail) VSCode extension by [Rich Somerfield](https://github.com/richie5um), this extension shows an animated trail reminiscent of an old CRT phosphor. The trail it creates makes it easier to track where the cursor is and with different colors for inserting and deleting code, it also helps convey very easily where changes are being made and how the buffer is being updated.

## Install

* Install via VSCode extensions install.

## Usage

* Ensure it is enabled and then just type.

## Example

**This needs to be updated to show adding and deleting text**

![Example](resources/usage.gif)

## Enable/Disable

You can enable/disable the plugin using the command:

* SnakeTrail.Enable
* SnakeTrail.Disable

Configuration changes are read and updated on the fly.

## Configuration

**This needs to be updated for the new configuration**

* You can modify the snake trail color (default / light / dark)
  * `"snakeTrail.color": "0,255,0"`
  * `"snakeTrail.colorLight": "0,255,0"`
  * `"snakeTrail.colorDark": "0,255,0"`
* You can modify the snake trail fade
  * `"snakeTrail.fadeMS": 100`
    * milliseconds
  * `"snakeTrail.fadeStart": 1.0`
    * the starting opacity value (between 0 and 1.0)
  * `"snakeTrail.fadeEnd": 0.2`
    * the final opacity value (between 0 and 1.0)
  * `"snakeTrail.fadeStep": 0.1`
    * the step decrement

## _Open Source_

Forked from [vscode-snake-trail](https://github.com/richie5um/vscode-snake-trail) and modified to introduce new behaviors.

If you like but want to make changes/improvements, please submit PRs rather than forking.
