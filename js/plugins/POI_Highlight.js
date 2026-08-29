//=============================================================================
// POI_Highlight.js
// Draws a highlight square over map events tagged as points of interest.
// Loaded via install-poi-highlight.js — no Plugin Manager registration needed.
//=============================================================================

(() => {
  'use strict';

  //--- Configuration ---------------------------------------------------------
  const CONFIG = {
    noteTag: /<poi(?::\s*(\d+))?>/i, // <poi> or <poi:switchId> (hides when switch is ON)
    color: 0xffff00,
    lineWidth: 2,
    size: 48,            // width/height of the square in pixels
    pulse: true,          // gentle opacity pulse
    pulseSpeed: 0.05,
    hideIfNoImage: false, // set true if you only want to highlight events WITH a graphic
    z: 4                  // render above tiles/characters in the tilemap's z-sort
  };

  //--- Helpers -----------------------------------------------------------
  function isPoiEvent(event) {
    const data = event.event();
    if (!data || !data.note) return false;
    const match = data.note.match(CONFIG.noteTag);
    if (!match) return false;
    const switchId = match[1] ? Number(match[1]) : null;
    if (switchId && $gameSwitches.value(switchId)) return false;
    if (CONFIG.hideIfNoImage) {
      const page = event.page();
      if (page && !page.image.characterName) return false;
    }
    return true;
  }

  //--- Sprite --------------------------------------------------------------
  class Sprite_PoiHighlight extends Sprite {
    constructor(event) {
      super();
      this._event = event;
      this._t = Math.random() * Math.PI * 2;
      this.anchor.set(0.5, 0.5);
      this.z = CONFIG.z;
      this._draw();
    }

    _draw() {
      const g = new PIXI.Graphics();
      const s = CONFIG.size;
      g.lineStyle(CONFIG.lineWidth, CONFIG.color, 1);
      g.drawRect(-s / 2, -s / 2, s, s);
      this.addChild(g);
    }

    update() {
      super.update();
      if (!this._event) return;
      this.x = this._event.screenX();
      this.y = this._event.screenY() - CONFIG.size / 2;
      this.visible = isPoiEvent(this._event);
      if (CONFIG.pulse) {
        this._t += CONFIG.pulseSpeed;
        this.opacity = 180 + Math.sin(this._t) * 75;
      }
    }
  }

  //--- Hook into Spriteset_Map ---------------------------------------------
  const _createCharacters = Spriteset_Map.prototype.createCharacters;
  Spriteset_Map.prototype.createCharacters = function () {
    _createCharacters.call(this);
    this._poiSprites = [];
    for (const event of $gameMap.events()) {
      if (event) {
        const sprite = new Sprite_PoiHighlight(event);
        this._poiSprites.push(sprite);
        this._tilemap.addChild(sprite);
      }
    }
  };

  const _update = Spriteset_Map.prototype.update;
  Spriteset_Map.prototype.update = function () {
    _update.call(this);
    if (this._poiSprites) {
      for (const sprite of this._poiSprites) sprite.update();
    }
  };
})();
