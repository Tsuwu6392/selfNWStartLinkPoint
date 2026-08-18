//=============================================================================
// RPG Maker MZ - Kpp_WeatherSpringMZ.js
//=============================================================================
// Copyright (c) 2018-2020 カッピ
//
// Released under the MIT license
// http://opensource.org/licenses/mit-license.php
//
// ウェブサイト
// https://birdwind.net/
//
// Twitter
// https://twitter.com/kappi_bw

/*:ja
 * @target MZ
 * @plugindesc 桜が舞う天候エフェクト
 * @author カッピ
 * @url https://birdwind.net/plugin/
 *
 * @help
 * 桜が舞う天候エフェクトを再生します。
 *
 * 事前準備として、
 * プラグイン配布ページにある「WeatherSpring.png」を、
 * img/systemフォルダに入れておいてください。
 *
 * プラグインコマンドで、天候を開始します。
 * 
 * 天候を停止するには、
 * イベントコマンド「天候の設定」で、
 * タイプを「なし」に指定します。
 *
 * @requiredAssets img/system/WeatherSpring
 *
 * @command ChangeWeather
 * @text 桜の天候開始
 * @desc 桜の天候エフェクトを開始する
 *
 * @arg power
 * @text 強さ
 * @desc 強さ：天候エフェクトの画像を一度に表示する量(1～9の数値)
 * @default 2
 * @type number
 * @min 1
 * @max 9
 *
 * @arg duration
 * @text 切り替え時間
 * @desc 天候エフェクトの切り替えにかかる時間(1～999の数値)
 * @default 60
 * @type number
 * @min 1
 * @max 999
 *
 * @arg wait
 * @text ウェイト
 * @desc 切り替え完了までウェイト
 * @default false
 * @type boolean
 *
 */

(function() {

	const pluginName = 'Kpp_WeatherSpringMZ';
	const parameters = PluginManager.parameters(pluginName);
	
	// プラグインコマンド
	PluginManager.registerCommand(pluginName, "ChangeWeather", function(args) {
		$gameScreen.changeWeather("spring", Number(args.power), Number(args.duration));
		
		if (args.wait == "true") this.wait(Number(args.duration));
	});

	const _Weather_createBitmaps = Weather.prototype._createBitmaps;
	Weather.prototype._createBitmaps = function() { 
		_Weather_createBitmaps.apply(this);
		this._springBitmap = ImageManager.loadSystem('WeatherSpring')
	};
	
	const _Weather_updateSprite = Weather.prototype._updateSprite;
	Weather.prototype._updateSprite = function(sprite) {
		if (this.type == 'spring') this._updateSpringSprite(sprite); 
		
		_Weather_updateSprite.apply(this, arguments);
	};
	
	Weather.prototype._updateSpringSprite = function(sprite) { 
	    sprite.bitmap = this._springBitmap; 
	    sprite.opacity -= 1;
	    if (sprite.opacity >= 160) {
	    	sprite.ax -= 3;
	    	sprite.ay += 1;
	    	sprite.rotation -= 0.01;
	    }
	    else if (sprite.opacity >= 110) {
	    	sprite.ax -= 1;
	    	sprite.ay += 4;
	    	sprite.rotation += 0.01;
	    }
	    else {
	    	sprite.ax -= 3;
	    	sprite.ay += 3;
	    	sprite.rotation -= 0.01;
	    }
	}; 

})();