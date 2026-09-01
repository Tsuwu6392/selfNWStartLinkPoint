//=============================================================================
// Bilingual_Core.js
//=============================================================================
/*~struct~Lang:
 * @param Tag
 * @text Language Tag
 * @desc Matches a <TAG> marker used in your text (2-4 uppercase letters),
 * or your DefaultLanguage tag for the untagged source segment.
 * @default EN
 *
 * @param Name
 * @text Display Name
 * @desc Name shown for this language in the Options menu.
 * @default English
 */
/*~struct~TextSize:
 * @param Name
 * @text Display Name
 * @desc Name shown for this size in the Options menu (e.g. "Small").
 * @default Normal
 *
 * @param Offset
 * @text Font size offset (px)
 * @desc Added to the project's own default font size (System > Advanced).
 * 0 = that default. Negative shrinks, positive enlarges.
 * @type number
 * @min -40
 * @max 40
 * @default 0
 */
/*:
 * @target MZ
 * @plugindesc Inline bilingual text selection + auto word-wrap v1.0.0
 * @author (custom)
 *
 * @param DefaultLanguage
 * @text Default / source language tag
 * @desc The untagged language at the start of every string. Usually your
 * source language (e.g. JA). This segment has no <TAG> in front of it.
 * @default JA
 *
 * @param EnableAutoWrap
 * @text Enable auto word-wrap
 * @type boolean
 * @default true
 *
 * @param WrapPadding
 * @text Wrap right-edge padding (px)
 * @desc Safety margin subtracted from window content width before wrapping.
 * @type number
 * @default 8
 *
 * @param OptionName
 * @text Options menu label
 * @desc The row label shown in the default Options menu.
 * @default Language
 *
 * @param AvailableLanguages
 * @text Language display name overrides (optional)
 * @desc Optional. The languages themselves are auto-detected from <TAG>
 * markers in your data -- use this only to give a tag a nicer display name.
 * @type struct<Lang>[]
 * @default []
 *
 * @param TextSizeOptionName
 * @text Text-size options menu label
 * @desc The row label shown in the default Options menu.
 * @default Text Size
 *
 * @param ScanPluginParameters
 * @text Scan other plugins' parameters for tags
 * @desc Also auto-detects <TAG> markers inside OTHER plugins' parameter
 * values (e.g. a quest-log plugin's note-text fields), not just the
 * database/common events/troops. Off by default to avoid false positives
 * from unrelated plugins that happen to use <XX>-shaped markers of their
 * own.
 * @type boolean
 * @default false
 *
 * @param TextSizes
 * @text Text size choices
 * @desc Offsets from the project's default font size (System > Advanced),
 * shown as a cycling Options row exactly like the volume sliders.
 * @type struct<TextSize>[]
 * @default ["{\"Name\":\"Small\",\"Offset\":\"-4\"}","{\"Name\":\"Normal\",\"Offset\":\"0\"}","{\"Name\":\"Large\",\"Offset\":\"4\"}","{\"Name\":\"X-Large\",\"Offset\":\"8\"}"]
 *
 * @param PoiOptionName
 * @text POI Highlight option label
 * @desc The row label shown in the Options menu.
 * @default POI Highlight
 *
 * @param PoiSize
 * @text POI highlight square size (px)
 * @desc Width/height of the highlight square.
 * @type number
 * @min 16
 * @max 128
 * @default 48
 *
 * @param PoiColor
 * @text POI highlight color
 * @desc Color of the highlight square (hex without #).
 * @type string
 * @default ffff00
 *
 * @param PoiPulse
 * @text POI highlight pulse
 * @type boolean
 * @default true
 *
 * @param CoordOptionName
 * @text Coordinates option label
 * @desc The row label shown in the Options menu.
 * @default Coordinates
 *
 * @param CoordFontSize
 * @text Coordinates font size
 * @type number
 * @default 20
 *
 * @param CoordTextColor
 * @text Coordinates text color
 * @desc Text color (CSS color string).
 * @default #ffffff
 *
 * @param CoordOutlineColor
 * @text Coordinates outline color
 * @desc Outline color (CSS color string).
 * @default #000000
 *
 * @help
 * ----------------------------------------------------------------------------
 * TEXT FORMAT
 * ----------------------------------------------------------------------------
 * Write all language variants in a single string, source language first
 * (untagged), followed by other languages behind <TAG> markers:
 *
 *   それは……大事でしょう。\n容易には選べぬ道。<EN>That is... a significant
 *   matter.\nA path one cannot choose lightly.
 *
 * - The source/default language (set in DefaultLanguage) needs NO tag.
 * - Additional languages are introduced with <XX> where XX is any 2-4
 *   uppercase letter code (<EN>, <VI>, etc). Add as many as you like.
 * - \n inside any language segment is treated as an intentional hard line
 *   break (a deliberate pause) and is NEVER removed or overridden by
 *   auto-wrap. Auto-wrap only inserts breaks WITHIN the text between
 *   existing \n's.
 * - Multi-line "Show Text" / "Scrolling Text" commands are several event
 *   commands under the hood, one per line. Tag EACH line independently
 *   (every line gets its own <EN>, etc.) -- the plugin resolves each line
 *   before MZ joins them, so this is the correct way to write a multi-line
 *   message and is handled safely even though it looks like repeated tags
 *   in the raw JSON.
 *
 * ----------------------------------------------------------------------------
 * SWITCHING LANGUAGE
 * ----------------------------------------------------------------------------
 * The plugin adds a row (named by OptionName) to the default MZ Options
 * menu. Pressing OK/Left/Right on that row cycles through languages, same
 * as a volume slider.
 *
 * Which languages appear there is fully automatic: on first use, the
 * plugin scans the database, common events, and troops for every <TAG>
 * marker actually in use and builds the list from that -- nothing needs
 * to be configured for this to work out of the box. If you want a nicer
 * label than the raw tag (e.g. "English" instead of "EN"), use the
 * optional AvailableLanguages parameter just to rename it; you don't need
 * to list every language there, only the ones whose label you want to
 * change.
 *
 * That choice is saved in the global config file (like BGM/SE volume),
 * NOT inside individual save files -- so it persists across new games and
 * loaded saves alike, and is available immediately from the title screen.
 * It also takes priority over the per-save language state below the
 * moment the player has changed it at least once.
 *
 * Below that, the plugin tracks its own active-language state internally
 * on $gameSystem (saved with the rest of your save data, and namespaced
 * so it can never collide with anything -- this plugin never reads or
 * writes any Game Variable for its own state). You can drive it purely
 * by script call if you never touch the Options menu row:
 *   Control Variables > Script: $gameSystem.setBilingualLanguage("EN")
 * Set it back to "" or the DefaultLanguage to fall back to source text.
 * Any other plugin/event that needs the active language tag should call
 * that same getter directly: $gameSystem.bilingualLanguage()
 *
 * Database text is re-applied whenever the language variable changes AND
 * a scene is loaded/refreshed. Any string field anywhere in $dataItems,
 * $dataWeapons, $dataArmors, $dataSkills, $dataActors, $dataEnemies,
 * $dataStates, $dataClasses, or $dataSystem that actually contains a
 * <TAG> marker is cached and resolved automatically -- not just name/
 * description, and including $dataSystem's nested terms/list fields
 * (armorTypes, terms.commands, terms.messages, etc). It's re-resolved
 * from a cached original copy each time, so switching mid-game is safe
 * and non-destructive.
 *
 * ----------------------------------------------------------------------------
 * TEXT SIZE
 * ----------------------------------------------------------------------------
 * The plugin adds a second row (named by TextSizeOptionName) to the same
 * Options menu, cycling through the choices in TextSizes -- each one an
 * offset from the project's own default font size (System > Advanced),
 * not a hardcoded pixel value, so "Normal" always matches whatever size
 * you actually authored the game at.
 *
 * This works by overriding $gameSystem.mainFontSize(), the one method
 * every window in the engine already calls to size its text -- so it
 * applies uniformly everywhere (dialogue, choices, menus, item lists),
 * and composes correctly with auto-wrap: the wrap hook already calls
 * resetFontSettings() before measuring text width, so a size change is
 * picked up automatically with no extra wiring. If some other plugin or
 * event calls $gameSystem.setMainFontSize() (e.g. a "change font size"
 * plugin command), this offset is added on top of that, not replacing it.
 *
 * Saved the same way as the language choice: global config file, not
 * per-save, available from the title screen.
 *
 * ----------------------------------------------------------------------------
 * OTHER PLUGINS' TEXT (titles, labels, custom windows)
 * ----------------------------------------------------------------------------
 * Any Window_Base-derived window that draws a tagged string via drawText()
 * or measures one via textWidth() -- not just drawTextEx()/message text --
 * gets it resolved to the active language automatically. This covers things
 * like a quest-log or notebook plugin's title fields, which are commonly
 * drawn with plain drawText() rather than drawTextEx().
 *
 * If a plugin's translatable text lives only in that plugin's OWN parameters
 * (e.g. quest/note text authored inside its plugin manager fields, rather
 * than in the database, common events, or troops), turn on
 * ScanPluginParameters so the automatic Language-list detection can find
 * those tags too. It's off by default because some plugins use their own
 * <XX>-shaped markers for unrelated purposes (e.g. <UP>, <ON>), which would
 * otherwise get mistaken for language tags.
 *
 * ----------------------------------------------------------------------------
 * LIMITATIONS
 * ----------------------------------------------------------------------------
 * - Plugin commands / script calls that string-match on exact text will NOT
 *   see tagged strings resolved. Keep conditional logic on switches/variables,
 *   not on text content, for any tagged string.
 * - Text baked into images (logos, menu graphics) is untouched.
 * - Word-wrap uses simple whitespace splitting for Latin-script languages
 *   and per-character splitting for the source (JA) segment. If you add a
 *   language that is neither, extend LANG_IS_CJK below.
 * - Larger text sizes only affect HORIZONTAL wrapping, which auto-wrap
 *   already handles. They do NOT resize windows or add scrolling, so a
 *   message window with a lot of text at a large size can still overflow
 *   its fixed height -- this plugin doesn't attempt to compensate for that.
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Bilingual_Core";
    const params = PluginManager.parameters(PLUGIN_NAME);
    const DEFAULT_LANG = String(params.DefaultLanguage || "JA");
    const AUTO_WRAP = params.EnableAutoWrap !== "false";
    const WRAP_PADDING = Number(params.WrapPadding || 8);
    const OPTION_NAME = String(params.OptionName || "Language");
    const TEXT_SIZE_OPTION_NAME = String(params.TextSizeOptionName || "Text Size");
    const SCAN_PLUGIN_PARAMETERS = params.ScanPluginParameters === "true";

    // AvailableLanguages is now OPTIONAL and purely cosmetic: a tag -> nicer
    // display name override (e.g. EN -> "English"). Which languages actually
    // show up in the Options menu is auto-detected from the game's own data
    // (see ensureLanguagesBuilt below), so a consumer installing this plugin
    // never has to enumerate anything by hand for it to work.
    let NAME_OVERRIDES = {};
    try {
        JSON.parse(params.AvailableLanguages || "[]")
            .map(s => JSON.parse(s))
            .forEach(e => {
                const tag = String(e.Tag || "").toUpperCase();
                if (tag) NAME_OVERRIDES[tag] = String(e.Name || tag);
            });
    } catch (e) {
        NAME_OVERRIDES = {};
    }

    // Text-size choices: {name, offset} pairs, offset relative to the
    // project's own default font size (see mainFontSize override below).
    // Always guaranteed at least one entry (offset 0, "Normal") even if
    // the parameter is empty/malformed, so the Options row never ends up
    // with nothing to cycle through.
    let TEXT_SIZES = [];
    try {
        TEXT_SIZES = JSON.parse(params.TextSizes || "[]")
            .map(s => JSON.parse(s))
            .map(e => ({ name: String(e.Name || "Normal"), offset: Number(e.Offset || 0) }))
            .filter(e => Number.isFinite(e.offset));
    } catch (e) {
        TEXT_SIZES = [];
    }
    if (TEXT_SIZES.length === 0) TEXT_SIZES = [{ name: "Normal", offset: 0 }];

    // POI Highlight settings
    const POI_OPTION_NAME = String(params.PoiOptionName || "POI Highlight");
    const POI_SIZE = Number(params.PoiSize || 48);
    const POI_COLOR = parseInt(String(params.PoiColor || "ffff00"), 16) || 0xffff00;
    const POI_PULSE = params.PoiPulse !== "false";

    // Coordinate Display settings
    const COORD_OPTION_NAME = String(params.CoordOptionName || "Coordinates");
    const COORD_FONT_SIZE = Number(params.CoordFontSize || 20);
    const COORD_TEXT_COLOR = String(params.CoordTextColor || "#ffffff");
    const COORD_OUTLINE_COLOR = String(params.CoordOutlineColor || "#000000");

    // Languages that wrap by character rather than by whitespace word.
    // Add codes here if you introduce another CJK-style language.
    const LANG_IS_CJK = new Set(["JA", "ZH", "KO"]);

    const TAG_SPLIT_RE = /<([A-Z]{2,4})>/g;

    //-------------------------------------------------------------------
    // Core: pick the active language's segment out of a tagged string
    //-------------------------------------------------------------------

    function currentLanguage() {
        // A language chosen from the Options menu is a persistent,
        // cross-save preference and wins once the player has set one.
        if (ConfigManager.language) return ConfigManager.language;
        // Otherwise fall back to this save's own internal state, tracked
        // on $gameSystem -- never a shared Game Variable slot.
        if ($gameSystem && $gameSystem.bilingualLanguage()) {
            return $gameSystem.bilingualLanguage();
        }
        return DEFAULT_LANG;
    }

    function languageIndex(tag) {
        const list = ensureLanguagesBuilt();
        const i = list.findIndex(e => e.tag === tag);
        return i === -1 ? 0 : i;
    }

    // The list of selectable languages is built once, lazily, by scanning
    // for every <TAG> marker that actually appears in the game's own data
    // -- not from a hand-maintained parameter list. This means a fresh
    // install of the plugin (with every other param left untouched) still
    // gets a fully working, correctly-populated Language option. It's safe
    // to defer this until the Options menu is actually touched: the
    // database, common events, and troops are all loaded long before the
    // player can reach a scene with an Options command (title screen
    // included), so nothing here runs before the data exists.
    let AVAILABLE_LANGUAGES = null;

    function collectTags(node, tags) {
        if (typeof node === "string") {
            let m;
            TAG_SPLIT_RE.lastIndex = 0;
            while ((m = TAG_SPLIT_RE.exec(node)) !== null) tags.add(m[1]);
        } else if (Array.isArray(node)) {
            for (const v of node) collectTags(v, tags);
        } else if (node && typeof node === "object") {
            for (const key in node) {
                if (Object.prototype.hasOwnProperty.call(node, key)) collectTags(node[key], tags);
            }
        }
    }

    function ensureLanguagesBuilt() {
        if (AVAILABLE_LANGUAGES) return AVAILABLE_LANGUAGES;

        const tags = new Set();
        for (const groupName of DB_GROUPS) collectTags(window[groupName], tags);
        // Common events and troop (battle) event pages are preloaded at
        // boot just like the database groups above, so dialogue tags
        // written there are picked up too -- not just item/skill text.
        collectTags(window.$dataCommonEvents, tags);
        collectTags(window.$dataTroops, tags);
        // Optional: other plugins' own parameters (e.g. a quest-log
        // plugin's note-text fields authored in its own plugin manager
        // params, never touching the database at all). $plugins is the
        // same array PluginManager.parameters() reads from, already
        // populated at boot. Off by default -- see ScanPluginParameters.
        if (SCAN_PLUGIN_PARAMETERS && Array.isArray(window.$plugins)) {
            for (const plugin of window.$plugins) {
                if (plugin && plugin.parameters) collectTags(plugin.parameters, tags);
            }
        }
        tags.delete(DEFAULT_LANG);

        AVAILABLE_LANGUAGES = [{ tag: DEFAULT_LANG, name: NAME_OVERRIDES[DEFAULT_LANG] || DEFAULT_LANG }];
        Array.from(tags).sort().forEach(tag => {
            AVAILABLE_LANGUAGES.push({ tag, name: NAME_OVERRIDES[tag] || tag });
        });
        return AVAILABLE_LANGUAGES;
    }

    // Game_System-level storage for the active language, private to this
    // plugin (a Game Variable is a flat, shared numeric namespace that any
    // other plugin/event can also be writing to -- a property namespaced
    // under $gameSystem can't collide with anything). Persists with the
    // save automatically since Game_System is part of save data.
    const _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function () {
        _Game_System_initialize.call(this);
        this._bilingualLanguage = "";
    };

    Game_System.prototype.bilingualLanguage = function () {
        return this._bilingualLanguage || "";
    };

    Game_System.prototype.setBilingualLanguage = function (tag) {
        this._bilingualLanguage = tag || "";
    };

    function setLanguageState(tag) {
        if ($gameSystem) $gameSystem.setBilingualLanguage(tag);
    }

    function selectLanguageText(raw) {
        if (typeof raw !== "string" || raw.indexOf("<") === -1) return raw;

        const lang = currentLanguage();
        if (lang === DEFAULT_LANG) {
            // Source language is everything before the first tag.
            const idx = raw.search(TAG_SPLIT_RE);
            return idx === -1 ? raw : raw.slice(0, idx);
        }

        // Walk all <TAG>segment pairs, return the one matching current lang.
        TAG_SPLIT_RE.lastIndex = 0;
        let match;
        const positions = [];
        while ((match = TAG_SPLIT_RE.exec(raw)) !== null) {
            positions.push({ tag: match[1], start: match.index, textStart: TAG_SPLIT_RE.lastIndex });
        }
        for (let i = 0; i < positions.length; i++) {
            if (positions[i].tag === lang) {
                const end = i + 1 < positions.length ? positions[i + 1].start : raw.length;
                return raw.slice(positions[i].textStart, end);
            }
        }
        // Requested language not found in this string -> fall back to source.
        const idx = raw.search(TAG_SPLIT_RE);
        return idx === -1 ? raw : raw.slice(0, idx);
    }

    //-------------------------------------------------------------------
    // Hook: message/scrolling-text LINES, before RPG Maker joins them
    // A multi-line "Show Text" (or Scrolling Text) command is actually
    // several separate event commands, one per line -- MZ only joins them
    // into one string (Game_Message.allText()) afterward, for the window
    // to draw. If a translator tags each line independently (the natural
    // way to write a multi-line message: "JP<EN>EN" per line), that join
    // produces a single blob containing multiple <EN> markers. The
    // whole-string resolver below can only find one clean split point per
    // string, so on a blob like that it grabs everything up to the FIRST
    // tag's *next* occurrence -- i.e. line 1's translation followed by
    // line 2's raw, untranslated source text. Resolving per line, before
    // that join happens, avoids the ambiguity entirely.
    //-------------------------------------------------------------------

    const _Game_Message_add = Game_Message.prototype.add;
    Game_Message.prototype.add = function (text) {
        _Game_Message_add.call(this, selectLanguageText(text));
    };

    //-------------------------------------------------------------------
    // Hook: event/message text, choices, scrolling text
    // Runs BEFORE MZ's normal escape processing so \C[n] \I[n] etc.
    // inside the selected segment still work normally afterward.
    //-------------------------------------------------------------------

    const _Window_Base_convertEscapeCharacters = Window_Base.prototype.convertEscapeCharacters;
    Window_Base.prototype.convertEscapeCharacters = function (text) {
        const selected = selectLanguageText(text);
        return _Window_Base_convertEscapeCharacters.call(this, selected);
    };

    //-------------------------------------------------------------------
    // Hook: plain drawText() / textWidth()
    // drawTextEx()/message text already goes through convertEscapeCharacters
    // above, but many plugins (quest logs, notebooks, custom status windows)
    // draw their own title/label fields with plain drawText() or measure
    // them with textWidth() instead -- neither of which touches
    // convertEscapeCharacters in stock MZ. Resolving the language here too
    // means a tagged string works no matter which drawing method a plugin
    // uses, and textWidth() reports the real (single-language) width rather
    // than measuring the whole raw multi-language blob, tags included.
    // These are separate call paths from drawTextEx's internal rendering
    // loop (which writes straight to this.contents, a Bitmap, not through
    // Window_Base.prototype.drawText), so there's no double-processing --
    // selectLanguageText is also a no-op on any string with no "<" in it,
    // which covers the vast majority of drawText/textWidth calls (menu
    // labels, numbers, etc.) with negligible overhead.
    //-------------------------------------------------------------------

    const _Window_Base_drawText = Window_Base.prototype.drawText;
    Window_Base.prototype.drawText = function (text, x, y, maxWidth, align) {
        _Window_Base_drawText.call(this, selectLanguageText(text), x, y, maxWidth, align);
    };

    const _Window_Base_textWidth = Window_Base.prototype.textWidth;
    Window_Base.prototype.textWidth = function (text) {
        return _Window_Base_textWidth.call(this, selectLanguageText(text));
    };

    //-------------------------------------------------------------------
    // Compatibility: Triacontane's PluginCommonBase / PluginManagerEx
    // Several community plugins built on that framework replace database
    // fields (name/description/note/profile) with getter-only accessors
    // that call PluginManagerEx.convertEscapeCharacters(rawText) fresh on
    // every read, so \N[n]/\V[n] etc. stay live. Since those fields can't
    // be written to (see safeAssign below), the entry point to patch
    // instead is this shared function itself -- select the language
    // segment first, same as the Window_Base hook above, then let the
    // original escape-code processing run on just that segment.
    //-------------------------------------------------------------------

    if (typeof PluginManagerEx !== "undefined" && typeof PluginManagerEx.convertEscapeCharacters === "function") {
        const _PluginManagerEx_convertEscapeCharacters = PluginManagerEx.convertEscapeCharacters;
        PluginManagerEx.convertEscapeCharacters = function (text) {
            return _PluginManagerEx_convertEscapeCharacters.call(this, selectLanguageText(text));
        };
    }

    //-------------------------------------------------------------------
    // Compatibility: MPP_ChoiceEX
    // Its per-choice visibility syntax ("Label if(condition)") is parsed
    // with a NON-global regex (/\s?if\((.+?)\)/, no /g flag) that assumes
    // at most one "if(...)" clause per choice string, and strips only the
    // FIRST match it finds. A bilingual-merged choice ("JP if(cond)<EN>EN
    // if(cond)") has TWO such clauses -- MPP_ChoiceEX's own condition
    // parsing runs directly on the raw event-command parameters, before
    // this plugin ever gets a chance to reduce the string to one language,
    // so it only ever strips the first (source-language) clause and
    // leaves the other language's "if(...)" dangling in the visible text.
    // Pre-resolving each choice string to just the active language HERE,
    // before MPP_ChoiceEX's addChoices() reads them, restores the
    // single-clause-per-string shape it was actually designed for.
    //-------------------------------------------------------------------

    if (typeof Game_Interpreter !== "undefined" && typeof Game_Interpreter.prototype.addChoices === "function") {
        const _Game_Interpreter_addChoices = Game_Interpreter.prototype.addChoices;
        Game_Interpreter.prototype.addChoices = function (params, index, data, d) {
            let langParams = params;
            if (Array.isArray(params) && Array.isArray(params[0])) {
                langParams = params.slice();
                langParams[0] = params[0].map(selectLanguageText);
            }
            return _Game_Interpreter_addChoices.call(this, langParams, index, data, d);
        };
    }

    //-------------------------------------------------------------------
    // Compatibility: command windows built via Window_Command.addCommand
    // (e.g. MenuSubCommand's parent/child menu entries defined in its own
    // plugin parameters). Command labels are drawn with plain drawText,
    // never drawTextEx, so they never reach the Window_Base hook above --
    // and since they live in a plugin's own parameters rather than
    // $dataSystem/database, the DB-caching patch below never sees them
    // either. addCommand is the one shared low-level method every command
    // window in the engine (menus, this plugin's own Options rows, shop
    // menus, third-party command windows) already funnels through, so
    // resolving the label there fixes MenuSubCommand and stays harmless
    // everywhere else -- untagged names pass through unchanged.
    //-------------------------------------------------------------------

    if (typeof Window_Command !== "undefined" && typeof Window_Command.prototype.addCommand === "function") {
        const _Window_Command_addCommand = Window_Command.prototype.addCommand;
        Window_Command.prototype.addCommand = function (name, symbol, enabled, ext) {
            _Window_Command_addCommand.call(this, selectLanguageText(name), symbol, enabled, ext);
        };
    }

    //-------------------------------------------------------------------
    // Compatibility: CBR_EroStatus
    // This plugin draws its own custom status window entirely outside the
    // engine's normal text pipeline -- Window_EroStatus.prototype.refresh
    // resolves \V[n]/\N[n]/\P[n]/eval-script substitution and then does
    // its own \{ \} (font size) / \C[n] (color) / \I[n] (icon) parsing and
    // width measurement, drawing via this.contents.drawText() directly. It
    // never calls Window_Base.prototype.convertEscapeCharacters, so none of
    // this plugin's other hooks ever see this text.
    //
    // CBR_EroStatus doesn't factor the substitution step out into its own
    // method, so there's no clean point to wrap -- the tag has to be
    // resolved to one language strictly BETWEEN its variable-substitution
    // pass and its formatting/width-measurement pass (resolving any later
    // would mean CBR_EroStatus measures and wraps against the padded
    // two-language text before drawing only half of it). That requires a
    // full override rather than a small hook. This is copied verbatim from
    // CBR_EroStatus.js's own Window_EroStatus.prototype.refresh, with
    // exactly one added line (marked below) -- if CBR_EroStatus is ever
    // updated upstream, this override needs to be re-diffed against it.
    //-------------------------------------------------------------------

    if (typeof Window_EroStatus !== "undefined") {
    Window_EroStatus.prototype.refresh = function() {
        const rect = this.itemLineRect(0);
        const x = rect.x;
        const y = rect.y;
        const width = rect.width;
        this.contents.clear();

        var test = CBR.eroStatus.data[CBR.eroStatus.pageNow];//このページの画像&&テキスト
        if(!test){
                return;
        }
        for(var obj of test["画像"]){

                var val = obj.val.replace(/\\V\[(\d+)\]/g,function(a,b){
                        return $gameVariables.value(b);
                });
                const bitmap = ImageManager.loadPicture(val.slice(0,-4));
                
                const pw = bitmap.width;
                const ph = bitmap.height;
                var top = 0;
                var left = 0;
                if(obj["左右"] =="中"){
                        left -= pw / 2;
                }else if(obj["左右"] =="右"){
                        left -= pw;
                }
                if(obj["上下"] =="中"){
                        top -= ph / 2;
                }else if(obj["上下"] =="下"){
                        top -= ph;
                }
                if(obj["透明度"]){
                        this.contents.paintOpacity = 255 * Number(obj["透明度"]) / 100;
                }
                var zoom = 1;
                if(obj["サイズ"]){
                        zoom = Number(obj["サイズ"]) / 100;
                }
                this.contents.blt(bitmap, 0, 0, pw, ph, Number(obj.x)+left, Number(obj.y)+top,pw*zoom,ph*zoom);
                this.contents.paintOpacity = 255;
        }
        
        //画像読み込み全部終わってなかったら終了
        if(!ImageManager.isReady()){
                return;
        }


        for(var obj of test["テキスト"]){
                //まず変数や値を変換
                var text = obj.val.replace(/\\(\\)|\\([VNP])\[(\d+)\]|\\(<)(.+)\\>/g,function(a,b,c,d,e,f){
                        if(b){//\\
                                return '\\';
                        }else if(c){//[VNP]
                                d = Number(d);
                                switch(c){
                                        case 'V':
                                                return $gameVariables.value(d);
                                                break;
                                        case 'N':
                                                return $gameActors._data[d]._name;
                                                break;
                                        case 'P':
                                                return $dataActors[$gameParty._actors[d-1]].name;
                                                break;
                                }
                        }else{//script
                                return eval(f);
                        }
                });
                // Bilingual_Core: resolve to the active language BEFORE CBR_EroStatus's
                // own formatting/width-measurement pass runs. text is Latin-safe already
                // (no \{ \} \C[n] \I[n] codes exist here, those are parsed next), so this
                // tag resolution never interferes with them.
                text = selectLanguageText(text);

                this.contents.context.font = this.contents._makeFontNameText();
                this.contents.fontSize = Number(obj["サイズ"]) || $gameSystem.mainFontSize();
                this.resetTextColor();

                const reg = RegExp(/\\([CI])\[(\d+)\]|\\\{|\\\}/, 'g');
                var ary;
                var c = 0;
                var left = 0;
                
                var strAry = [];//分割された文字列いれる
                var wAry = [];//分割された横幅いれる
                var fAry = [];//分割ごとの操作を入れる
                
                var ii = 0;
                var strWidth = 0;
                var maxH = this.contents.fontSize;
                //テキストのwidthや分割集め
                while ((ary = reg.exec(text)) !== null){

                        var str = text.substring(c,ary.index);//描写したい部分を抜き出す
                        strAry[ii] = str;
                        wAry[ii] = this.textWidth(str);
                        strWidth += wAry[ii];

                        switch(ary[1]){
                                case undefined://{や}の時
                                        if(ary[0].substring(1)=="{"){
                                                fAry[ii] = {type:"{"};
                                                this.contents.fontSize += 6;
                                                if(maxH < this.contents.fontSize){
                                                        maxH = this.contents.fontSize;
                                                }
                                        }else{
                                                fAry[ii] = {type:"}"};
                                                this.contents.fontSize -= 6;
                                        }
                                        break;
                                default:
                                        fAry[ii] = {type:ary[1],val:ary[2]};
                                        break;
                        }

                        c = reg.lastIndex;
                        ii++;
                }
                if(c != text.length){
                        var str = text.substring(c);//描写したい部分を抜き出す
                        strAry[ii] = str;
                        fAry[ii] = {type:false,val:false};
                        wAry[ii] = this.textWidth(str);
                        strWidth += wAry[ii];
                        ii++;
                }

                this.contents.context.font = this.contents._makeFontNameText();
                this.contents.fontSize = Number(obj["サイズ"]) || $gameSystem.mainFontSize();

                var left = 0;
                var top = 0;
                if(obj["左右"] == "中"){
                        left -= strWidth / 2;
                }else if(obj["左右"] == "右"){
                        left -= strWidth;
                }
                for(var i=0; i<ii; i++){        
                        var top = 0;
                        if(obj["上下"] == "中"){
                                top = maxH / 2 - this.contents.fontSize / 2;
                        }else if(obj["上下"] == "下"){
                                top = maxH - this.contents.fontSize;
                        }
                        this.drawText(strAry[i], Number(obj.x)+left, Number(obj.y)+top, wAry[i], this.contents.fontSize, "right");
                        left += wAry[i];
                        switch(fAry[i].type){
                                case 'C':
                                        this.changeTextColor(ColorManager.textColor(fAry[i].val));//カラチェン
                                        break;
                                case 'I':
                                        //return $gameActors._data[d]._name;
                                        break;
                                case "{":
                                        this.contents.fontSize += 6;
                                        break;
                                case "}":
                                        this.contents.fontSize -= 6;
                                        break;
                        }
                }

                this.resetTextColor();
                this.contents.fontSize = $gameSystem.mainFontSize();
                this._CBR_drawn = true;
        }
    };

    }

    //-------------------------------------------------------------------
    // Database text (item/skill/actor/etc. name & description fields)
    // Cache originals once, re-resolve whenever language changes.
    //-------------------------------------------------------------------

    const DB_GROUPS = ["$dataItems", "$dataWeapons", "$dataArmors", "$dataSkills",
        "$dataActors", "$dataEnemies", "$dataStates", "$dataClasses", "$dataSystem",
        "$dataMapInfos"];
    let _dbCache = null;
    let _dbLangApplied = null;

    // Recursively find every string field that actually contains a <TAG>
    // marker, anywhere in `node` (array, plain object, or nested mix of
    // both -- e.g. $dataSystem's terms.commands list or terms.messages
    // dict). Returns a same-shaped structure holding only those tagged
    // leaves (arrays/objects are pruned to just the paths that matter), or
    // undefined if nothing under `node` is tagged. Untagged strings are
    // left alone entirely -- selectLanguageText is a no-op for them anyway,
    // so this only ever touches fields the converter actually merged,
    // whatever their name or depth.
    function snapshotTaggedStrings(node) {
        if (typeof node === "string") {
            return node.indexOf("<") !== -1 ? node : undefined;
        }
        if (Array.isArray(node)) {
            const out = [];
            let found = false;
            node.forEach((v, i) => {
                const snap = snapshotTaggedStrings(v);
                if (snap !== undefined) {
                    out[i] = snap;
                    found = true;
                }
            });
            return found ? out : undefined;
        }
        if (node && typeof node === "object") {
            const out = {};
            let found = false;
            for (const key in node) {
                if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
                const snap = snapshotTaggedStrings(node[key]);
                if (snap !== undefined) {
                    out[key] = snap;
                    found = true;
                }
            }
            return found ? out : undefined;
        }
        return undefined;
    }

    // Track which keys we've already warned about, so a read-only field
    // that shows up on many entries (e.g. every item's "description")
    // doesn't spam the console once per entry.
    const _warnedReadonlyKeys = new Set();

    // Assign node[key] = value, but tolerate another plugin having made
    // that specific field a getter-only accessor (no setter) or otherwise
    // non-writable -- e.g. a plugin that computes "description" on the
    // fly from note tags. Overwriting it isn't possible in that case, so
    // the field is left as whatever it already was rather than crashing
    // the whole scene load. Logs once per key in playtest so the
    // incompatibility is visible without spamming release builds.
    function safeAssign(node, key, value) {
        try {
            node[key] = value;
        } catch (e) {
            if ($gameTemp && $gameTemp.isPlaytest() && !_warnedReadonlyKeys.has(key)) {
                console.warn(
                    `Bilingual_Core: couldn't set "${key}" (defined elsewhere as ` +
                    `read-only/getter-only) -- leaving it as-is. Another plugin ` +
                    `likely computes this field dynamically.`, node
                );
                _warnedReadonlyKeys.add(key);
            }
        }
    }

    // Mirror-image of snapshotTaggedStrings: walks a cached snapshot and
    // writes selectLanguageText(cached) back into the matching position on
    // the live `node`, mutating it in place.
    function applyTaggedSnapshot(node, snapshot) {
        if (typeof snapshot === "string") {
            return selectLanguageText(snapshot);
        }
        if (Array.isArray(snapshot)) {
            snapshot.forEach((sub, i) => {
                if (sub === undefined) return;
                safeAssign(node, i, applyTaggedSnapshot(node[i], sub));
            });
            return node;
        }
        if (snapshot && typeof snapshot === "object") {
            for (const key in snapshot) {
                if (!Object.prototype.hasOwnProperty.call(snapshot, key)) continue;
                safeAssign(node, key, applyTaggedSnapshot(node[key], snapshot[key]));
            }
            return node;
        }
        return node;
    }

    function buildDbCacheIfNeeded() {
        if (_dbCache) return;
        _dbCache = {};
        for (const groupName of DB_GROUPS) {
            const group = window[groupName];
            if (!group) continue;
            const snap = snapshotTaggedStrings(group);
            if (snap !== undefined) _dbCache[groupName] = snap;
        }
    }

    function applyDatabaseLanguage() {
        const lang = currentLanguage();
        if (lang === _dbLangApplied) return;
        buildDbCacheIfNeeded();

        for (const groupName in _dbCache) {
            const group = window[groupName];
            if (!group) continue;
            applyTaggedSnapshot(group, _dbCache[groupName]);
        }
        _dbLangApplied = lang;
    }

    const _Scene_Base_start = Scene_Base.prototype.start;
    Scene_Base.prototype.start = function () {
        applyDatabaseLanguage();
        _Scene_Base_start.call(this);
    };

    //-------------------------------------------------------------------
    // Compatibility: AltMenuScreen2MZ (map name display)
    // AltMenuScreen2MZ creates a Window_MapNameAlt3 that reads the map
    // name via $gameMap.displayName() during Scene_Menu.create(), which
    // fires BEFORE Scene_Base.start() and applyDatabaseLanguage().
    // Window_MapNameAlt3 itself is scoped inside AltMenuScreen2MZ's IIFE
    // and can't be hooked from outside. Instead, resolve tags at the
    // source: $gameMap.displayName(). selectLanguageText is a no-op on
    // untagged strings, so this is harmless everywhere else.
    //-------------------------------------------------------------------

    const _Game_Map_displayName = Game_Map.prototype.displayName;
    Game_Map.prototype.displayName = function () {
        return selectLanguageText(_Game_Map_displayName.call(this));
    };

    //-------------------------------------------------------------------
    // Auto word-wrap
    // Splits on existing \n first (hard, preserved breaks), then wraps
    // only within each resulting segment to fit the window's content width.
    //-------------------------------------------------------------------

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
        const lang = currentLanguage();
        const cjk = LANG_IS_CJK.has(lang);
        return text
            .split("\n")
            .map(seg => wrapSegment(bitmap, seg, maxWidth, cjk))
            .join("\n");
    }

    // Window_Message indents every line by a left margin whenever a face
    // graphic is showing (face width + spacing -- see the core's own
    // newLineX), and that same margin is re-applied on every line, not
    // just the first. Mirror that here so wrap width matches what's
    // actually available, not the full content width.
    function messageLeftMargin(win) {
        if (typeof win.newLineX !== "function") return 0;
        try {
            return win.newLineX({ rtl: false });
        } catch (e) {
            return 0;
        }
    }

    // Window_Message.prototype.startMessage() converts/wraps the message
    // text BEFORE it calls updatePlacement() -- so any plugin (like
    // LL_MessageWindowAdjust) that resizes the window inside
    // updatePlacement() (e.g. narrower when no face graphic is shown) does
    // so AFTER we've already measured against the old, wider width. Forcing
    // placement to happen first means our wrap measurement always matches
    // whatever width the window actually ends up at for this message.
    // Calling it twice is harmless: the engine calls it again right after,
    // with the same $gameMessage state, so it just recomputes the same
    // numbers.
    const _Window_Message_startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function () {
        if (AUTO_WRAP && typeof this.updatePlacement === "function") {
            this.updatePlacement();
        }
        _Window_Message_startMessage.call(this);
    };

    const _Window_Message_convertEscapeCharacters = Window_Message.prototype.convertEscapeCharacters;
    Window_Message.prototype.convertEscapeCharacters = function (text) {
        let result = _Window_Message_convertEscapeCharacters.call(this, text);
        if (AUTO_WRAP) {
            if (this.contents && typeof this.resetFontSettings === "function") {
                this.resetFontSettings();
            }
            const margin = messageLeftMargin(this);
            // this.contents is a Bitmap created once at window construction
            // and never resized afterward -- plugins that narrow the window
            // per-message (e.g. LL_MessageWindowAdjust, when no face graphic
            // is showing) only ever change this.width/innerWidth, not the
            // Bitmap. Measuring against contents.width means we're always
            // reading a stale, too-generous number. innerWidth is the live
            // value that actually reflects the window's current on-screen
            // size, so that's what has to drive the wrap.
            const baseWidth = typeof this.innerWidth === "number" ? this.innerWidth : (this.contents ? this.contents.width : 640);
            const maxWidth = baseWidth - margin - WRAP_PADDING;
            result = autoWrapText(this.contents, result, maxWidth);
        }
        return result;
    };

    //-------------------------------------------------------------------
    // Options menu: language switch
    // Stored via ConfigManager, i.e. the global config file shared by
    // every save (same place BGM/SE volume live) -- not inside a save
    // file -- so it's available from the title screen and stays put
    // across new games and loaded saves.
    //-------------------------------------------------------------------

    ConfigManager.language = "";

    const _ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function () {
        const config = _ConfigManager_makeData.call(this);
        config.language = this.language;
        return config;
    };

    const _ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function (config) {
        _ConfigManager_applyData.call(this, config);
        this.language = config.language || "";
        setLanguageState(this.language || currentLanguage());
    };

    // Re-assert the Options-menu choice over whatever tag happens to be
    // stored in a save's internal state, so it's the persistent preference
    // it looks like in the menu, not something a save can silently revert.
    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _DataManager_setupNewGame.call(this);
        if (ConfigManager.language) setLanguageState(ConfigManager.language);
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        _DataManager_extractSaveContents.call(this, contents);
        if (ConfigManager.language) setLanguageState(ConfigManager.language);
    };

    //-------------------------------------------------------------------
    // Options menu: text size
    // Same storage approach as language (global config, not per-save).
    // Applied via $gameSystem.mainFontSize() -- the one method every
    // window in the engine already calls to size its text -- so a
    // change here reaches dialogue, choices, and menus uniformly with
    // no per-window wiring, and composes correctly with auto-wrap since
    // that hook already calls resetFontSettings() before measuring.
    //-------------------------------------------------------------------

    ConfigManager.textSizeOffset = 0;
    ConfigManager.poiHighlight = true;
    ConfigManager.coordDisplay = true;

    function textSizeIndex(offset) {
        const i = TEXT_SIZES.findIndex(e => e.offset === offset);
        return i === -1 ? 0 : i;
    }

    const _ConfigManager_makeData2 = ConfigManager.makeData;
    ConfigManager.makeData = function () {
        const config = _ConfigManager_makeData2.call(this);
        config.textSizeOffset = this.textSizeOffset;
        config.poiHighlight = this.poiHighlight;
        config.coordDisplay = this.coordDisplay;
        return config;
    };

    const _ConfigManager_applyData2 = ConfigManager.applyData;
    ConfigManager.applyData = function (config) {
        _ConfigManager_applyData2.call(this, config);
        const offset = Number(config.textSizeOffset);
        this.textSizeOffset = Number.isFinite(offset) ? offset : 0;
        this.poiHighlight = config.poiHighlight !== undefined ? !!config.poiHighlight : true;
        this.coordDisplay = config.coordDisplay !== undefined ? !!config.coordDisplay : true;
    };

    const _Game_System_mainFontSize = Game_System.prototype.mainFontSize;
    Game_System.prototype.mainFontSize = function () {
        return _Game_System_mainFontSize.call(this) + (ConfigManager.textSizeOffset || 0);
    };

    const _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
    Window_Options.prototype.addGeneralOptions = function () {
        _Window_Options_addGeneralOptions.call(this);
        const list = ensureLanguagesBuilt();
        if (list.length < 2 && $gameTemp && $gameTemp.isPlaytest()) {
            // Not a misconfiguration -- languages are auto-detected from
            // <TAG> markers found in the database/common events/troops.
            // Seeing this means none were found there, so there's nothing
            // for the option to cycle to yet.
            console.warn(
                "Bilingual_Core: no <TAG> markers were found in the database, " +
                "common events, or troops, so the Language option only has " +
                "one entry (" + DEFAULT_LANG + ") and can't cycle. If your " +
                "translated text only lives in map events, that's expected -- " +
                "the option list is still built from data available at boot."
            );
        }
        this.addCommand(OPTION_NAME, "language");
        if (TEXT_SIZES.length > 1) this.addCommand(TEXT_SIZE_OPTION_NAME, "textSize");
        this.addCommand(POI_OPTION_NAME, "poiHighlight");
        this.addCommand(COORD_OPTION_NAME, "coordDisplay");
    };

    const _Window_Options_statusText = Window_Options.prototype.statusText;
    Window_Options.prototype.statusText = function (index) {
        const symbol = this.commandSymbol(index);
        if (symbol === "language") {
            const list = ensureLanguagesBuilt();
            return list[languageIndex(currentLanguage())].name;
        }
        if (symbol === "textSize") {
            return TEXT_SIZES[textSizeIndex(ConfigManager.textSizeOffset || 0)].name;
        }
        if (symbol === "poiHighlight") {
            return ConfigManager.poiHighlight ? "ON" : "OFF";
        }
        if (symbol === "coordDisplay") {
            return ConfigManager.coordDisplay ? "ON" : "OFF";
        }
        return _Window_Options_statusText.call(this, index);
    };

    const _Window_Options_processOk = Window_Options.prototype.processOk;
    Window_Options.prototype.processOk = function () {
        const symbol = this.currentSymbol();
        if (symbol === "language") {
            this.changeLanguage(1);
            return;
        }
        if (symbol === "textSize") {
            this.changeTextSize(1);
            return;
        }
        if (symbol === "poiHighlight") {
            this.toggleOption("poiHighlight");
            return;
        }
        if (symbol === "coordDisplay") {
            this.toggleOption("coordDisplay");
            return;
        }
        _Window_Options_processOk.call(this);
    };

    const _Window_Options_cursorRight = Window_Options.prototype.cursorRight;
    Window_Options.prototype.cursorRight = function () {
        const symbol = this.currentSymbol();
        if (symbol === "language") {
            this.changeLanguage(1);
            return;
        }
        if (symbol === "textSize") {
            this.changeTextSize(1);
            return;
        }
        if (symbol === "poiHighlight" || symbol === "coordDisplay") {
            this.toggleOption(symbol);
            return;
        }
        _Window_Options_cursorRight.call(this);
    };

    const _Window_Options_cursorLeft = Window_Options.prototype.cursorLeft;
    Window_Options.prototype.cursorLeft = function () {
        const symbol = this.currentSymbol();
        if (symbol === "language") {
            this.changeLanguage(-1);
            return;
        }
        if (symbol === "textSize") {
            this.changeTextSize(-1);
            return;
        }
        if (symbol === "poiHighlight" || symbol === "coordDisplay") {
            this.toggleOption(symbol);
            return;
        }
        _Window_Options_cursorLeft.call(this);
    };

    // Cycle to the next/previous language, persist it, and redraw just this
    // row (matching how the built-in volume options update themselves
    // without a full window refresh).
    Window_Options.prototype.changeLanguage = function (delta) {
        const list = ensureLanguagesBuilt();
        const idx = languageIndex(currentLanguage());
        const next = (idx + delta + list.length) % list.length;
        const tag = list[next].tag;
        ConfigManager.language = tag;
        setLanguageState(tag);
        this.redrawItem(this.findSymbol("language"));
        SoundManager.playCursor();
    };

    // Cycle to the next/previous text size and persist it. No redraw of
    // OTHER already-open windows is attempted here -- like the built-in
    // volume sliders, the visible effect is on whatever window draws
    // text next (this Options window's own row redraws immediately).
    Window_Options.prototype.changeTextSize = function (delta) {
        const idx = textSizeIndex(ConfigManager.textSizeOffset || 0);
        const next = (idx + delta + TEXT_SIZES.length) % TEXT_SIZES.length;
        ConfigManager.textSizeOffset = TEXT_SIZES[next].offset;
        this.redrawItem(this.findSymbol("textSize"));
        SoundManager.playCursor();
    };

    // Generic boolean toggle for simple ON/OFF options.
    Window_Options.prototype.toggleOption = function (symbol) {
        ConfigManager[symbol] = !ConfigManager[symbol];
        this.redrawItem(this.findSymbol(symbol));
        SoundManager.playCursor();
    };

    //-------------------------------------------------------------------
    // POI Highlight
    // Draws a pulsing highlight square over map events whose note
    // contains <poi> or <poi:switchId> (hidden when that switch is ON).
    // Gated by ConfigManager.poiHighlight (toggleable in Options).
    //-------------------------------------------------------------------

    const POI_NOTE_RE = /<poi(?::\s*(\d+))?>/i;

    function isPoiEvent(event) {
        if (!ConfigManager.poiHighlight) return false;
        const data = event.event();
        if (!data || !data.note) return false;
        const match = data.note.match(POI_NOTE_RE);
        if (!match) return false;
        const switchId = match[1] ? Number(match[1]) : null;
        if (switchId && $gameSwitches.value(switchId)) return false;
        return true;
    }

    function Sprite_PoiHighlight(event) {
        Sprite.call(this);
        this._event = event;
        this._t = Math.random() * Math.PI * 2;
        this.anchor.set(0.5, 0.5);
        this.z = 4;
        this._drawPoi();
    }
    Sprite_PoiHighlight.prototype = Object.create(Sprite.prototype);
    Sprite_PoiHighlight.prototype.constructor = Sprite_PoiHighlight;

    Sprite_PoiHighlight.prototype._drawPoi = function () {
        var g = new PIXI.Graphics();
        var s = POI_SIZE;
        g.lineStyle(2, POI_COLOR, 1);
        g.drawRect(-s / 2, -s / 2, s, s);
        this.addChild(g);
    };

    Sprite_PoiHighlight.prototype.update = function () {
        Sprite.prototype.update.call(this);
        if (!this._event) return;
        this.x = this._event.screenX();
        this.y = this._event.screenY() - POI_SIZE / 2;
        this.visible = isPoiEvent(this._event);
        if (POI_PULSE && this.visible) {
            this._t += 0.05;
            this.opacity = 180 + Math.sin(this._t) * 75;
        }
    };

    var _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function () {
        _Spriteset_Map_createCharacters.call(this);
        this._poiSprites = [];
        for (var i = 0; i < $gameMap.events().length; i++) {
            var ev = $gameMap.events()[i];
            if (ev) {
                var sprite = new Sprite_PoiHighlight(ev);
                this._poiSprites.push(sprite);
                this._tilemap.addChild(sprite);
            }
        }
    };

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function () {
        _Spriteset_Map_update.call(this);
        if (this._poiSprites) {
            for (var i = 0; i < this._poiSprites.length; i++) {
                this._poiSprites[i].update();
            }
        }
    };

    //-------------------------------------------------------------------
    // Coordinate Display
    // Shows "X: n  Y: n" in the top-right corner on the map.
    // Gated by ConfigManager.coordDisplay (toggleable in Options).
    //-------------------------------------------------------------------

    function Sprite_Coordinates() {
        Sprite.call(this, new Bitmap(160, 40));
        this.bitmap.fontSize = COORD_FONT_SIZE;
        this.bitmap.textColor = COORD_TEXT_COLOR;
        this.bitmap.outlineColor = COORD_OUTLINE_COLOR;
        this.bitmap.outlineWidth = 4;
        this.anchor.x = 1;
        this.x = Graphics.width - 8;
        this.y = 8;
        this._lastX = -1;
        this._lastY = -1;
        this._refreshCoord();
    }
    Sprite_Coordinates.prototype = Object.create(Sprite.prototype);
    Sprite_Coordinates.prototype.constructor = Sprite_Coordinates;

    Sprite_Coordinates.prototype.update = function () {
        Sprite.prototype.update.call(this);
        this.visible = !!ConfigManager.coordDisplay;
        if (!this.visible || !$gamePlayer) return;
        var x = $gamePlayer.x;
        var y = $gamePlayer.y;
        if (x !== this._lastX || y !== this._lastY) {
            this._lastX = x;
            this._lastY = y;
            this._refreshCoord();
        }
    };

    Sprite_Coordinates.prototype._refreshCoord = function () {
        this.bitmap.clear();
        this.bitmap.drawText(
            "X: " + this._lastX + "  Y: " + this._lastY,
            0, 0, 160, 40, "right"
        );
    };

    var _Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects = function () {
        _Scene_Map_createDisplayObjects.call(this);
        this._bilingualCoordSprite = new Sprite_Coordinates();
        this.addChild(this._bilingualCoordSprite);
    };

    //-------------------------------------------------------------------
    // Public API
    // A small, stable surface for other plugins (or a future compatibility
    // patch in this file, like the CBR_EroStatus override above) to resolve
    // a tagged string themselves, without needing to know any of this
    // plugin's internals. No-op on any string with no <TAG> marker in it.
    //   Bilingual_Core.selectLanguageText("それは<EN>That is")
    //-------------------------------------------------------------------

    window.Bilingual_Core = { selectLanguageText };

})();
