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
 * @param LanguageVariable
 * @text (Optional) Mirror to Game Variable ID
 * @desc Off by default (0). The plugin tracks its own language state
 * internally now -- only set this if some OTHER plugin/event needs to
 * read the active language tag out of a Game Variable directly. Pick an
 * ID your project isn't already using for anything else.
 * @type variable
 * @default 0
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
 * so it can never collide with a Game Variable another plugin is using).
 * You can drive it purely by script call if you never touch the Options
 * menu row:
 *   Control Variables > Script: $gameSystem.setBilingualLanguage("EN")
 * Set it back to "" or the DefaultLanguage to fall back to source text.
 *
 * If some OTHER plugin or event needs to read the active language tag
 * out of a Game Variable directly, set LanguageVariable to an ID your
 * project isn't using for anything else -- it's off (0) by default and
 * purely a read-only mirror; the plugin's own logic never depends on it.
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
 * LIMITATIONS
 * ----------------------------------------------------------------------------
 * - Plugin commands / script calls that string-match on exact text will NOT
 *   see tagged strings resolved. Keep conditional logic on switches/variables,
 *   not on text content, for any tagged string.
 * - Text baked into images (logos, menu graphics) is untouched.
 * - Word-wrap uses simple whitespace splitting for Latin-script languages
 *   and per-character splitting for the source (JA) segment. If you add a
 *   language that is neither, extend LANG_IS_CJK below.
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Bilingual_Core";
    const params = PluginManager.parameters(PLUGIN_NAME);
    const DEFAULT_LANG = String(params.DefaultLanguage || "JA");
    const LANG_VAR_ID = Number(params.LanguageVariable || 0);
    const AUTO_WRAP = params.EnableAutoWrap !== "false";
    const WRAP_PADDING = Number(params.WrapPadding || 8);
    const OPTION_NAME = String(params.OptionName || "Language");

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
        // Last resort: the optional Game Variable mirror, only if the
        // project has explicitly opted into one (LANG_VAR_ID > 0).
        if (LANG_VAR_ID > 0 && $gameVariables) {
            const v = $gameVariables.value(LANG_VAR_ID);
            if (v) return String(v);
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

    // Set the plugin's own internal state, and -- only if the project has
    // opted into it (LANG_VAR_ID > 0) -- mirror the choice into a Game
    // Variable too, so an other plugin/event reading it directly still
    // sees the right value. The plugin's own behavior never depends on
    // that mirror; it's purely for outside consumers.
    function setLanguageState(tag) {
        if ($gameSystem) $gameSystem.setBilingualLanguage(tag);
        if (LANG_VAR_ID > 0 && $gameVariables) $gameVariables.setValue(LANG_VAR_ID, tag);
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
    // Database text (item/skill/actor/etc. name & description fields)
    // Cache originals once, re-resolve whenever language changes.
    //-------------------------------------------------------------------

    const DB_GROUPS = ["$dataItems", "$dataWeapons", "$dataArmors", "$dataSkills",
        "$dataActors", "$dataEnemies", "$dataStates", "$dataClasses", "$dataSystem"];
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

    const _Window_Message_convertEscapeCharacters = Window_Message.prototype.convertEscapeCharacters;
    Window_Message.prototype.convertEscapeCharacters = function (text) {
        let result = _Window_Message_convertEscapeCharacters.call(this, text);
        if (AUTO_WRAP) {
            const maxWidth = this.contents ? this.contents.width - WRAP_PADDING : 640;
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
    };

    const _Window_Options_statusText = Window_Options.prototype.statusText;
    Window_Options.prototype.statusText = function (index) {
        const symbol = this.commandSymbol(index);
        if (symbol === "language") {
            const list = ensureLanguagesBuilt();
            return list[languageIndex(currentLanguage())].name;
        }
        return _Window_Options_statusText.call(this, index);
    };

    const _Window_Options_processOk = Window_Options.prototype.processOk;
    Window_Options.prototype.processOk = function () {
        if (this.currentSymbol() === "language") {
            this.changeLanguage(1);
            return;
        }
        _Window_Options_processOk.call(this);
    };

    const _Window_Options_cursorRight = Window_Options.prototype.cursorRight;
    Window_Options.prototype.cursorRight = function () {
        if (this.currentSymbol() === "language") {
            this.changeLanguage(1);
            return;
        }
        _Window_Options_cursorRight.call(this);
    };

    const _Window_Options_cursorLeft = Window_Options.prototype.cursorLeft;
    Window_Options.prototype.cursorLeft = function () {
        if (this.currentSymbol() === "language") {
            this.changeLanguage(-1);
            return;
        }
        _Window_Options_cursorLeft.call(this);
    };

    // Cycle to the next/previous language, persist it, mirror it to the
    // Game Variable, and redraw just this row (matching how the built-in
    // volume options update themselves without a full window refresh).
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

})();
