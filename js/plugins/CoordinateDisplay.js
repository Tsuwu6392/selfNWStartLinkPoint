//=============================================================================
// CoordinateDisplay.js
//=============================================================================
/*:
 * @target MV MZ
 * @plugindesc Shows the player's current map coordinates in the top-right corner of the screen.
 * @author
 *
 * @param fontSize
 * @text Font Size
 * @type number
 * @default 20
 *
 * @param textColor
 * @text Text Color
 * @type string
 * @default #ffffff
 *
 * @param outlineColor
 * @text Outline Color
 * @type string
 * @default #000000
 *
 * @help
 * CoordinateDisplay.js
 *
 * Continuously shows "X: n  Y: n" (the player's map tile coordinates)
 * in the top-right corner while on the map screen.
 *
 * No plugin commands, no setup — just enable it.
 */

(() => {
  const pluginName = "CoordinateDisplay";
  const params = PluginManager.parameters(pluginName);
  const fontSize = Number(params.fontSize || 20);
  const textColor = String(params.textColor || "#ffffff");
  const outlineColor = String(params.outlineColor || "#000000");

  class Sprite_Coordinates extends Sprite {
    constructor() {
      super(new Bitmap(160, 40));
      this.bitmap.fontSize = fontSize;
      this.bitmap.textColor = textColor;
      this.bitmap.outlineColor = outlineColor;
      this.bitmap.outlineWidth = 4;
      this.anchor.x = 1;
      this.x = Graphics.width - 8;
      this.y = 8;
      this._lastX = -1;
      this._lastY = -1;
      this.refresh();
    }

    update() {
      super.update();
      if (!$gamePlayer) return;
      const x = $gamePlayer.x;
      const y = $gamePlayer.y;
      if (x !== this._lastX || y !== this._lastY) {
        this._lastX = x;
        this._lastY = y;
        this.refresh();
      }
    }

    refresh() {
      this.bitmap.clear();
      this.bitmap.drawText(`X: ${this._lastX}  Y: ${this._lastY}`, 0, 0, 160, 40, "right");
    }
  }

  const _Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
  Scene_Map.prototype.createDisplayObjects = function() {
    _Scene_Map_createDisplayObjects.call(this);
    this._coordinateSprite = new Sprite_Coordinates();
    this.addChild(this._coordinateSprite);
  };
})();
