//=============================================================================
// TA_AdventureNote_BilingualWrap.js
//=============================================================================
/*:
 * @target MZ
 * @plugindesc Extends Bilingual_Core's auto word-wrap to TA_AdventureNoteMZ's note windows, with auto-resize (incl. live on language switch). v1.2.1
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
 * It also auto-resizes Window_MainEvent to fit however many lines the
 * wrapped note text actually needs (never shrinking below the configured
 * MainEventWindowHeight), and shifts Window_SubEventHeader / Window_SubEventList
 * down to match, so longer translations no longer spill across the window
 * boundary below it. This re-sizing runs both when the AdventureNote scene
 * opens and live if the player switches language while the scene is open.
 *
 * ----------------------------------------------------------------------------
 * REQUIREMENTS / LOAD ORDER
 * ----------------------------------------------------------------------------
 * Place this BELOW both Bilingual_Core and TA_AdventureNoteMZ in the plugin
 * list. It reads Bilingual_Core's own EnableAutoWrap / WrapPadding /
 * DefaultLanguage parameters directly, so the two never disagree about
 * settings -- there is nothing to configure here.
 *
 * REQUIRES a small addition to TA_AdventureNoteMZ.js itself: its window and
 * scene classes (Window_MainEvent, Window_SubEventHeader, Window_SubEventList,
 * Window_SubEventNote, Scene_AdventureNote) are declared inside that file's
 * own IIFE with no global export, so a separate plugin file has no way to
 * reach them otherwise. TA_AdventureNoteMZ.js now has these five lines added
 * right before its closing `})();`:
 *   window.Window_MainEvent = Window_MainEvent;
 *   window.Window_SubEventHeader = Window_SubEventHeader;
 *   window.Window_SubEventList = Window_SubEventList;
 *   window.Window_SubEventNote = Window_SubEventNote;
 *   window.Scene_AdventureNote = Scene_AdventureNote;
 * Purely additive -- doesn't change any of TA_AdventureNoteMZ's own behavior.
 * If you ever update TA_AdventureNoteMZ.js from an upstream source, re-add
 * these five lines or this whole patch plugin goes back to silently doing
 * nothing (no error -- its guards are designed to no-op safely if the
 * classes aren't found, which is exactly what masked this the first time).
 *
 * If Bilingual_Core is missing/disabled, or if TA_AdventureNoteMZ's window
 * classes still aren't found, this plugin safely does nothing rather than
 * throwing an error.
 *
 * ----------------------------------------------------------------------------
 * KNOWN LIMITATION (pre-existing, not caused by this patch)
 * ----------------------------------------------------------------------------
 * Window_SubEventNote has its own refresh() and redraws (and re-wraps) every
 * time its note_index changes, so it updates live if the player switches
 * language while it's open. Window_MainEvent updates live too (text, size,
 * and the position of the windows below it) via this plugin's own polling
 * hook -- no limitation left here as of v1.1.0.
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

    // Shared by both the scene-create sizing and the live-resize-on-
    // language-change hook below. Mirrors the y passed to drawMSNote() in
    // drawMSTexts(): header row + divider line take up the first two line
    // heights before the note text starts.
    function computeRequiredHeight(win) {
        const topOffset = win.lineHeight() * 2;
        const lines = win._bilingualLastWrapLines || 1;
        const bottomMargin = win.itemPadding();
        const requiredInner = topOffset + lines * win.lineHeight() + bottomMargin;
        return requiredInner + win.padding * 2;
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
                // Stashed for the auto-resize block below -- lets it know how
                // many lines the wrap actually produced without re-measuring.
                this._bilingualLastWrapLines = result.split("\n").length;
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
                if (AUTO_WRAP) this._bilingualLiveResize();
            }
        };

        // Re-sizes this window if the new language's wrapped text needs a
        // different height than what's currently allotted, and repositions
        // Window_SubEventHeader / Window_SubEventList to match. Floors at
        // this window's originally configured height (_bilingualBaseHeight,
        // captured once at scene-create time) -- same floor the initial
        // sizing below uses, so it can grow OR shrink back but never go
        // below what the author configured.
        Window_MainEvent.prototype._bilingualLiveResize = function () {
            const base = this._bilingualBaseHeight || this.height;
            const requiredOuter = Math.max(computeRequiredHeight(this), base);
            if (requiredOuter !== this.height) {
                this.move(this.x, this.y, this.width, requiredOuter);
                this.createContents();
                this.refresh();
            }

            const scene = SceneManager._scene;
            if (!scene || typeof Scene_AdventureNote === "undefined" || !(scene instanceof Scene_AdventureNote)) return;
            if (scene._maineventWindow !== this) return;

            const delta = requiredOuter - base;
            if (delta === scene._bilingualHeightDelta) return;
            scene._bilingualHeightDelta = delta;

            const header = scene._ssheaderWindow;
            if (header && typeof scene._bilingualHeaderBaseY === "number") {
                header.move(header.x, scene._bilingualHeaderBaseY + delta, header.width, header.height);
            }
            const list = scene._subeventlistWindow;
            if (list && typeof scene._bilingualListBaseY === "number") {
                list.move(list.x, scene._bilingualListBaseY + delta, list.width, list.height);
            }
        };
    }

    // ------------------------------------------------------------------
    // Auto-resize: MainEventWindowHeight is a fixed plugin parameter,
    // sized for ~1-2 lines. Wrapped text in a longer language can need
    // more lines than that budget holds, and the overflow used to spill
    // into Window_SubEventHeader directly below it (zero gap, by design).
    //
    // This measures the wrapped line count right after Window_MainEvent's
    // first draw, grows the window to fit if it's too short (never
    // shrinks below the author's configured height), and shifts
    // Window_SubEventHeader / Window_SubEventList down by the same
    // amount so the original gap is preserved either way.
    //
    // Runs at scene-create time, and again live if the player switches
    // language while the scene is open (see _bilingualLiveResize above).
    // Window_SubEventNote is a separate overlay window and isn't
    // affected by this.
    // ------------------------------------------------------------------
    if (AUTO_WRAP && typeof Scene_AdventureNote !== "undefined") {
        if (typeof Scene_AdventureNote.prototype.createMainEventWindow === "function") {
            const _createMainEventWindow = Scene_AdventureNote.prototype.createMainEventWindow;
            Scene_AdventureNote.prototype.createMainEventWindow = function () {
                _createMainEventWindow.call(this);
                this._bilingualHeightDelta = 0;

                const win = this._maineventWindow;
                if (!win) return;

                win._bilingualBaseHeight = win.height;
                const requiredOuter = Math.max(computeRequiredHeight(win), win._bilingualBaseHeight);

                if (requiredOuter > win._bilingualBaseHeight) {
                    this._bilingualHeightDelta = requiredOuter - win._bilingualBaseHeight;
                    win.move(win.x, win.y, win.width, requiredOuter);
                    win.createContents();
                    win.refresh();
                }
            };
        }

        // Shifts a Scene_AdventureNote window-rect method's y down by
        // whatever _bilingualHeightDelta createMainEventWindow (above)
        // computed earlier in the same create() call, and caches the
        // *unshifted* y on the scene (by cacheKey) so a later live language
        // switch can reposition the window without recomputing the rect.
        function shiftRectDown(rectMethodName, cacheKey) {
            if (typeof Scene_AdventureNote.prototype[rectMethodName] !== "function") return;
            const _rectMethod = Scene_AdventureNote.prototype[rectMethodName];
            Scene_AdventureNote.prototype[rectMethodName] = function () {
                const rect = _rectMethod.call(this);
                this[cacheKey] = rect.y;
                rect.y += this._bilingualHeightDelta || 0;
                return rect;
            };
        }
        shiftRectDown("subEventHeaderWindowRect", "_bilingualHeaderBaseY");
        shiftRectDown("subEventListWindowRect", "_bilingualListBaseY");
    }

})();
