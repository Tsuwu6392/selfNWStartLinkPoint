//=============================================================================
// TA_AdventureNote_BilingualWrap.js
//=============================================================================
/*:
 * @target MZ
 * @plugindesc Extends Bilingual_Core's auto word-wrap to TA_AdventureNoteMZ's note windows. v1.0.0
 * @author (custom)
 * @base Bilingual_Core
 * @base TA_AdventureNoteMZ
 * @orderAfter Bilingual_Core
 * @orderAfter TA_AdventureNoteMZ
 *
 * @help
 * ----------------------------------------------------------------------------
 * WHAT THIS DOES
 * ----------------------------------------------------------------------------
 * Bilingual_Core's auto word-wrap only patches Window_Message -- it does not
 * reach any other window, including TA_AdventureNoteMZ's note windows, which
 * draw long note text via drawTextEx() with no wrap of their own. This
 * plugin applies the same wrap behavior Bilingual_Core uses for the message
 * window to Window_MainEvent and Window_SubEventNote.
 *
 * Language-tag resolution (<EN>, <VI>, etc.) already works in these windows
 * without this plugin -- Bilingual_Core patches that generically at the
 * Window_Base level. This plugin ONLY adds the missing wrap step on top.
 *
 * ----------------------------------------------------------------------------
 * REQUIREMENTS / LOAD ORDER
 * ----------------------------------------------------------------------------
 * Place this BELOW both Bilingual_Core and TA_AdventureNoteMZ in the plugin
 * list. It reads Bilingual_Core's own EnableAutoWrap / WrapPadding /
 * DefaultLanguage parameters directly, so the two never disagree about
 * settings -- there is nothing to configure here.
 *
 * If Bilingual_Core is missing/disabled, or if TA_AdventureNoteMZ's window
 * classes aren't found (e.g. a future version renames them), this plugin
 * safely does nothing rather than throwing an error.
 *
 * ----------------------------------------------------------------------------
 * KNOWN LIMITATION (pre-existing, not caused by this patch)
 * ----------------------------------------------------------------------------
 * Window_SubEventNote has its own refresh() and redraws (and re-wraps) every
 * time its note_index changes, so it updates live if the player switches
 * language while it's open.
 *
 * Window_MainEvent only draws its text once, in initialize(). If you need it
 * to re-wrap on a live language change while open, it would need its own
 * refresh() hook -- ask if you want that added too.
 */

(() => {
    "use strict";

    // Bail out cleanly if Bilingual_Core isn't present/enabled.
    if (!window.Bilingual_Core || typeof window.Bilingual_Core.selectLanguageText !== "function") return;
    // Bail out cleanly if neither target window class exists.
    if (typeof Window_MainEvent === "undefined" && typeof Window_SubEventNote === "undefined") return;

    // Read Bilingual_Core's OWN parameters so wrap on/off, padding, and the
    // default/source language always match what Bilingual_Core itself is
    // using -- no duplicated/divergent config here.
    const bcParams = PluginManager.parameters("Bilingual_Core");
    const AUTO_WRAP = bcParams.EnableAutoWrap !== "false";
    const WRAP_PADDING = Number(bcParams.WrapPadding || 8);
    const DEFAULT_LANG = String(bcParams.DefaultLanguage || "JA");

    // Mirrors Bilingual_Core's own LANG_IS_CJK set. Kept local (rather than
    // reaching into Bilingual_Core's private closure, which isn't exposed)
    // so this plugin has no hidden coupling beyond the public parameters
    // read above. Extend here too if you add a non-Latin, non-space-
    // delimited language.
    const LANG_IS_CJK = new Set(["JA", "ZH", "KO"]);

    function currentLanguage() {
        if (ConfigManager.language) return ConfigManager.language;
        if ($gameSystem && $gameSystem.bilingualLanguage()) return $gameSystem.bilingualLanguage();
        return DEFAULT_LANG;
    }

    const MEASURE_STRIP_RE = /\x1b(?:[$.|^!><{}]|[A-Z]+\[[^\]]*\])/gi;
    function measureWidth(bitmap, str) {
        return bitmap.measureTextWidth(str.replace(MEASURE_STRIP_RE, ""));
    }

    function wrapSegment(bitmap, segment, maxWidth, cjk) {
        if (measureWidth(bitmap, segment) <= maxWidth) return segment;
        const units = cjk ? segment.split("") : segment.split(" ");
        const joiner = cjk ? "" : " ";
        let lines = [""];
        let cur = 0;
        for (const unit of units) {
            const test = lines[cur] ? lines[cur] + joiner + unit : unit;
            if (lines[cur] && measureWidth(bitmap, test) > maxWidth) {
                cur++;
                lines[cur] = unit;
            } else {
                lines[cur] = test;
            }
        }
        return lines.join("\n");
    }

    function autoWrapText(bitmap, text, maxWidth) {
        const cjk = LANG_IS_CJK.has(currentLanguage());
        return text
            .split("\n")
            .map(seg => wrapSegment(bitmap, seg, maxWidth, cjk))
            .join("\n");
    }

    // Layer a wrap step on top of whatever convertEscapeCharacters this
    // window class currently resolves to -- at patch time that's already
    // Bilingual_Core's Window_Base override (language-tag resolution), so
    // the call order is: resolve language tag -> wrap the result. Exactly
    // mirrors how Bilingual_Core itself patches Window_Message.
    function patchWrap(windowClass) {
        if (typeof windowClass === "undefined" || !windowClass.prototype) return;
        const _convertEscapeCharacters = windowClass.prototype.convertEscapeCharacters;
        windowClass.prototype.convertEscapeCharacters = function (text) {
            let result = _convertEscapeCharacters.call(this, text);
            if (AUTO_WRAP && this.contents) {
                if (typeof this.resetFontSettings === "function") this.resetFontSettings();
                const baseWidth = typeof this.innerWidth === "number" ? this.innerWidth : this.contents.width;
                const maxWidth = baseWidth - WRAP_PADDING;
                result = autoWrapText(this.contents, result, maxWidth);
            }
            return result;
        };
    }

    patchWrap(typeof Window_MainEvent !== "undefined" ? Window_MainEvent : undefined);
    patchWrap(typeof Window_SubEventNote !== "undefined" ? Window_SubEventNote : undefined);

    // Live re-wrap: Window_MainEvent only draws once in initialize(), so if
    // the player changes language while the AdventureNote scene is open
    // (e.g. via a plugin command, not just the Options menu), the note text
    // wouldn't update until the window is rebuilt. This polls once per
    // frame (cheap: a string compare) and only refreshes on an actual
    // change -- the same _lastX/_lastY pattern Bilingual_Core's own
    // Sprite_Coordinates already uses.
    if (typeof Window_MainEvent !== "undefined") {
        const _Window_MainEvent_initialize = Window_MainEvent.prototype.initialize;
        Window_MainEvent.prototype.initialize = function (rect) {
            _Window_MainEvent_initialize.call(this, rect);
            this._bilingualLastLang = currentLanguage();
        };

        Window_MainEvent.prototype.refresh = function () {
            this.contents.clear();
            this.drawMSTexts();
        };

        const _Window_MainEvent_update = Window_MainEvent.prototype.update;
        Window_MainEvent.prototype.update = function () {
            _Window_MainEvent_update.call(this);
            const lang = currentLanguage();
            if (lang !== this._bilingualLastLang) {
                this._bilingualLastLang = lang;
                this.refresh();
            }
        };
    }

})();
