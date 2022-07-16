var html2canvas = require('html2canvas');
const { ipcRenderer } = require('electron');
var open = require("open");

var keyEditMode = false;

function drawImageProp(ctx, img, x, y, w, h, offsetX, offsetY) {

    if (arguments.length === 2) {
        x = y = 0;
        w = ctx.canvas.width;
        h = ctx.canvas.height;
    }

    // default offset is center
    offsetX = typeof offsetX === "number" ? offsetX : 0.5;
    offsetY = typeof offsetY === "number" ? offsetY : 0.5;

    // keep bounds [0.0, 1.0]
    if (offsetX < 0) offsetX = 0;
    if (offsetY < 0) offsetY = 0;
    if (offsetX > 1) offsetX = 1;
    if (offsetY > 1) offsetY = 1;

    var iw = img.width,
        ih = img.height,
        r = Math.min(w / iw, h / ih),
        nw = iw * r,   // new prop. width
        nh = ih * r,   // new prop. height
        cx, cy, cw, ch, ar = 1;

    // decide which gap to fill    
    if (nw < w) ar = w / nw;                             
    if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  // updated
    nw *= ar;
    nh *= ar;

    // calc source rectangle
    cw = iw / (nw / w);
    ch = ih / (nh / h);

    cx = (iw - cw) * offsetX;
    cy = (ih - ch) * offsetY;

    // make sure source rectangle is valid
    if (cx < 0) cx = 0;
    if (cy < 0) cy = 0;
    if (cw > iw) cw = iw;
    if (ch > ih) ch = ih;

    // fill image in dest. rectangle
    ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
}

function imageCached(image) {
	for (var i = 0; i < window.imageList.length; i++) {
		if (path.normalize(window.imageList[i]) == path.normalize(image)) return true;
	}
	return false;
}

//MAIN GAME CONTROLLER
class gameManager{
	constructor(args){
		this.states;
		this.chapter = args.chapter;
		this.locale = args.locale || "en";
		this.actionSet = args.actionSet;
		this.actions = requireUncached(path.join(__dirname, `/game_data/${window.appSettings.locale}/chapters/${this.chapter}/${this.actionSet}.json`));
		this.sysvars = {};
		this.currentChar;
		this.paused = true;
		this.actionsCached;
		this.iterator = 0;
	}
	act(actions){
		if(!actions || actions.length<1) return console.log("No actions!", actions);

		if (actions[0].affected) {
			var selectSysvarResult = actions[0].sysvarResults[this.sysvars[actions[0].sysvarCheck]];

			this.currentChar = charlist.findChar(selectSysvarResult.character);
			
			this.nextMove(selectSysvarResult.character, selectSysvarResult, actions);
		}
		else{
			if (!charlist.findChar(actions[0].character)) return console.log("Can't find the character, returning...");

			this.currentChar = charlist.findChar(actions[0].character);

			this.nextMove(actions[0].character, actions[0], actions);
		}

		this.iterator++;
	}
	nextMove(character, result, actions){
		charlist.findChar(character).do(result, () => {
			//NEXT ACTION IS SET IN THE CURRENT FILE
			if (!actions[0].next) {
				//MOVE TO NEXT ACTION
				actions.shift();
				//ACT THE NEXT ACTION
				if (actions.length > 0) this.act(actions);
				//END THE GAME IF NO ACTIONS LEFT
				else {
					$(".event_manager").unbind();
					$(document).unbind("keyup_next");
					this.endGame();
				}
			}
			//NEXT ACTION SET IN A DIFFERENT FILE
			else{
				this.actionSet = actions[0].next;
				this.actions = requireUncached(path.join(__dirname, `/game_data/${window.appSettings.locale}/chapters/${this.chapter}/${actions[0].next}.json`));
				this.actionStep = 0;
				this.iterator = 0;
				this.act(window.game.actions);
			}
		});
	}
	saveState(pos, callback){
		var gameSave = { 
			actionSet: this.actionSet,
			chapter: this.chapter,
			sysvars: this.sysvars,
			iterator: this.iterator,
			currentChar: this.currentChar.pseudonym
		};

		html2canvas($(".game_contents")[0]).then(function(canvas) {
			//COMPRESS IMAGE IF ENABLED IN THE SETTINGS
			if (window.identity.compress_previews) {
				var resizeTo = { width: 144, height: 94 };
	            var extra_canvas = document.createElement("canvas");
	            extra_canvas.setAttribute('width',resizeTo.width);
	            extra_canvas.setAttribute('height',resizeTo.height);
	            var ctx = extra_canvas.getContext('2d');
	            ctx.imageSmoothingEnabled = true;

	            drawImageProp(ctx, canvas, 0, 0, resizeTo.width, resizeTo.height);
			    gameSave.imgdata = extra_canvas.toDataURL("image/png");
			}
			//OTHERWISE USE ORIGINAL IMAGE
			else gameSave.imgdata = canvas.toDataURL("image/png");
		 
			var data = JSON.stringify(gameSave, null, 2);
			fs.writeFile(path.join(window.home_dir, `/saves/slot_${pos}.json`), data, (err) => {
				if (err) throw err;
				if (callback && typeof callback === 'function') callback();
			});
		});
	}
	loadState(pos, callback){
		$(".page").hide();

		$(".main_menu").hide();
		$(".pause_menu").hide();
		this.paused = false;
		$(".game_contents").show();

		fs.readFile(path.join(window.home_dir, `/saves/slot_${pos}.json`), (err, data) => {
			if (err) return console.log(err);

			if(window.game.currentChar && window.game.currentChar.dialogue) clearInterval(window.game.currentChar.dialogue.interval);

			var fileContents = JSON.parse(data);

			var tempActions = requireUncached(path.join(__dirname, `/game_data/${window.appSettings.locale}/chapters/${fileContents.chapter}/${fileContents.actionSet}.json`));
			
			for(var i = 0; i < fileContents.iterator-1; i++) tempActions.shift();

			this.sysvars = fileContents.sysvars;
			this.actionSet = fileContents.actionSet;
			this.chapter = fileContents.chapter;
			this.iterator = fileContents.iterator-1;

			this.act(tempActions);

			if (callback && typeof callback === 'function') callback();
		});
	}
	restart(){
		this.actionSet =  window.chapterList.find(x => x.id === this.chapter).entry;
		this.actions = requireUncached(path.join(__dirname, `/game_data/${window.appSettings.locale}/chapters/${this.chapter}/primary_script.json`));
		this.sysvars = {};
		this.actionStep = 0;
		this.iterator = 0;

		this.startGame();
	}
	startGame(){
		//PREVENT ACCIDENTAL DOUBLE SELECTION WITH A SKIP KEY
		if (!this.paused) return;
		//START GAME AND UNPAUSE THE DEFAULT GAME INSTANCE
		this.paused = false;
		//HIDE ALL PAGES
		$(".page").hide();
		//HIDE PAUSE MENU
		$(".pause_menu").hide();
		//HIDE MAIN MENU
		$('.main_menu').hide();
		//FADE OUT THE CHAPTER MENU SLOWLY
		$('.ep_menu').fadeOut('slow', () => {
			//DRAW THE SCENE
			$(".game_contents").show();
			//RUN FIRST SLIDE IN CHAPTER
			this.act(this.actions);
		});
	}
	endGame() {
		console.log("No more actions left!");
		//GAME RESET
		this.paused = false;
		$(".game_contents").fadeOut('slow', () => {
			//GAME IS OVER, IF YOU WANT A GAME OVER SCREEN, SHOW IT HERE
			$('.main_menu').fadeIn();
		});
	}
}
//CHARACTER INSTANCE
class character{
	constructor(args){
		if(Object.keys(args).length) Object.keys(args).forEach(key => { this[key] = args[key]; });

		this.dialogue;
		this.diagComplete = true;
	}
	typeOut(string, unskippable, callback, length = 25){
		this.diagComplete = false;
		this.dialogue = {};
		this.dialogue.text = string.split('');
		this.dialogue.callback = callback;
		this.dialogue.unskippable = unskippable;
		this.dialogue.interval = setInterval(() => {
			if (window.game.paused || !this.dialogue) return;
			this.dialogue.running = true;
			$(".speech").append(this.dialogue.text[0]);
			this.dialogue.text.shift();
			if (this.dialogue.text.length<=0) {
				clearInterval(this.dialogue.interval);
				this.diagComplete = true;
				if (this.dialogue.callback && typeof this.dialogue.callback === 'function') this.dialogue.callback();
				this.dialogue = null;
			}
		}, length);
	}
	skipDialogue(){
		if (this.dialogue && this.dialogue.running && !this.dialogue.unskippable) {
			clearInterval(this.dialogue.interval);
			$(".speech").append(this.dialogue.text.join(''));
			this.diagComplete = true;
			if (this.dialogue.callback && typeof this.dialogue.callback === 'function') this.dialogue.callback();
			this.dialogue = null;
		}
	}
	guest(guest){ return charlist.findChar(guest.character); }
	do(args, callback, guest = null){
		$(".speech").empty();
		$(".speech_box").hide();
		$(".name").empty().hide();
		$(".character").empty().hide();
		$(".background").empty();
		$(".choice_area").empty().addClass("inactive");

		if (args.emote) {
			var emoteURL = path.join(__dirname, 'assets/characters', this.dirname, this.pseudonym+'_'+args.emote+'.png');

			if (!imageCached(emoteURL)) emoteURL = path.join(__dirname, 'assets/img/dummy.png');

			var effect_style = '';
			if (args.effect) effect_style += `animation:${args.effect.name} ${args.effect.duration?args.effect.duration+'s':''} ${args.effect.count?args.effect.count:''};`;

			$(".character").append(`
				<div 
					class="charimagewrapper ${args.flip_emote?'flipped':''}"
					style="${effect_style}"
				>
					<img src="${emoteURL}">
				</div>
			`).show();
		}
		//IF SCENE BACKGROUND IS DEFINED, APPEND IT TO THE SCENE
		if(args.scene) $(".background").append(`<img src="${path.join(__dirname, 'assets/scenes', args.scene)}.png">`);
		//IF NAME ISNT HIDDEN, IS DEFINED, OR AN OVERRIDE IS SPECIFIED, ADD THE NAME
		if (this.name && !args.hideName || args.name_override) {
			if (args.name_override) $(".name").append(args.name_override);
			else $(".name").append(this.name);
			$(".name").show();
		}
		//IF THE SCENE HAS A GUIEST CHARACTER, ADD IT
		if (args.guest) {
			//GET GUEST CHARACTER'S SPRITE
			var guestEmoteURL = path.join(__dirname, 'assets/characters', this.guest(args.guest).dirname, this.guest(args.guest).pseudonym+'_'+args.guest.emote+'.png');
			//IF NO SPRITE IS FOUND IN CACHE, USE FALLBACK
			if (!imageCached(guestEmoteURL)) guestEmoteURL = path.join(__dirname, 'assets/img/dummy.png');
			//PREPARE THE CODE TO ADD TO THE SCENE
			var dataToAppend = `
				<div class="charimagewrapper ${args.guest.flip_emote?'flipped':''}">
					<img src="${guestEmoteURL}">
				</div>
			`;
			//DEPENDING ON ORDER SPECIFIED, APPEND OR PREPEND THE GUEST TO THE SCENE
			if (args.guest.order > 0) $(".character").append(dataToAppend);
			else $(".character").prepend(dataToAppend);
		}
		//UNBIND THE OLD SCENE CODE
		$(".event_manager").unbind();
		$(document).unbind("keyup_next");

		function getChoices(){
			if (args.choices) {
				for (var i = 0; i < args.choices.length; i++) {
					if (args.choices[i].sysvarInput) {
						$(".choice_area").append(`
							<div class="choice_input_container">
								<input type="text" class="input_${i}">
								<button class="choice_${i}">Ok</button>
							</div>
						`);
					}
					else {
						$(".choice_area").append(`<button class="choice_${i}">${args.choices[i].option}</button>`);
					}

					(function (num) {
						$(`.choice_${i}`).click(() => {
							if (args.choices[num].sysvar) {
								for (var j = 0; j < args.choices[num].sysvar.length; j++) {
									if (args.choices[num].sysvarInput) {
										window.game.sysvars[args.choices[num].sysvar[j].name] = $(`.input_${num}`).first().val();
									}
									else {
										window.game.sysvars[args.choices[num].sysvar[j].name] = args.choices[num].sysvar[j].value;
									}
								}
							}

							if (args.choices[num].next) {
								window.game.actionSet = args.choices[num].next;

								window.game.actions = requireUncached(path.join(__dirname, `/game_data/${window.appSettings.locale}/chapters/${window.game.chapter}/${args.choices[num].next}.json`));
								
								window.game.actionStep = 0;
								window.game.iterator = 0;
								window.game.act(window.game.actions);
							}
							else{
								if(callback && typeof callback === 'function') callback();
							}
						});
					})(i);
				}
				$(".choice_area").removeClass("inactive");
			}
			else { 
				if(callback && typeof callback === 'function') {
					$(".event_manager").on("click", callback);
					//gohere

					$(document).bind("keyup_next", function(e, event){
						if(event.keyCode == (window.appSettings.skip || 32) && !window.game.paused && window.okToNext) callback();
					});
				}
			}
		}

		if (!args.speak) {
			if(args.wait){
				setTimeout(function(){
					if(callback && typeof callback === 'function') callback();
				}, args.wait);
			}
			else getChoices();
		}
		else{
			$(".speech_box").show();

			let regex = /[^{\}]+(?=})/g;
			let speech = args.speak;

			(speech.match(regex) || []).map(function(str) {
				speech = speech.replace(`{${str}}`, window.game.sysvars[str]);
			});

			this.typeOut(speech, args.unskippable, getChoices, args.typeTime);
		}
	}
}
//CHARACTER LIST
class charList{
	constructor(charlist){
		this.list = [];
		for(var i = 0; i < charlist.length; i++){
			this.list.push(new character(charlist[i]));
		}
	}
	findChar(pseudonym){
		for (var i = 0; i < this.list.length; i++) {
			if (this.list[i].pseudonym == pseudonym) return this.list[i];
		}
	}
}
//PROMPT CONTROLLER
class customPrompt{
	constructor(args){
		$(".confirm_page").find(".confirm_prompt").empty().append(args.text);
		$(".confirm_page").find(".confirm_choices").empty();
		$(".confirm_page").find(".toggle_page").click(function(){ args.callback(args.default); });
		for (var i = 0; i < args.options.length; i++) {
			(function(i){
				var $btn = $("<button>", { type: 'button', text: args.options[i].text});
				$btn.click(() => {
					if(args.callback && typeof args.callback === 'function') args.callback(args.options[i].value);
					if (!args.chain) $(".confirm_page").hide();
				});
				$(".confirm_page").find(".confirm_choices").append($btn);
			})(i);
		}
		this.prompt();
	}
	prompt(){ $(".confirm_page").show(); }
	dismiss(){ $(".confirm_page").hide(); }
}
//SAVE MANAGER
class saveManager{
	constructor(args = {}){
		//INITIALIZE SAVES DIRECTORY
		this.saveDir = args.saveDir || path.join(window.home_dir, '/saves/');
		//GENERATE SAVES
		this.genSaves();
	}
	parseSaves(){
		//READ THE SAVES DIRECTORY
		fs.readdir(this.saveDir, (err, files) => {
			files.forEach(file => {
				//GET SLOT NUMBER OF EACH SAVE
				var slotNum = path.basename(file, '.json').split("_")[1];
				//GET IMAGE PREVIEW OF EACH SAVE
				var grabPreview = requireUncached(path.join(this.saveDir, file));
				//RESET SAVE AND LOAD SLOTS BEFORE APPENDING
				$(`.lmm_slot_` + slotNum).empty();
				$(`.smm_slot_` + slotNum).empty();
				//IF PREVIEW EXISTS, APPEND TO SAVE AND LOAD SLOTS
				if (grabPreview.imgdata) {
					$(`.lmm_slot_` + slotNum).append(`<img class="i_slot_preview" src="${grabPreview.imgdata}">`);
					$(`.smm_slot_` + slotNum).append(`<img class="i_slot_preview" src="${grabPreview.imgdata}">`);
				}
				//APPEND A LOAD SAVE BUTTON TO THE LOAD SLOT
				$(`.lmm_slot_` + slotNum).append(`<button class="act_load act_l_${slotNum}" data-chapter="${grabPreview.chapter}" data-loadnum="${slotNum}">${window.lang_dict.slot} ${slotNum}</button>`);
				//ATTACH A LISTENER TO EACH LOAD BUTTON
				$(`.act_load.act_l_` + slotNum).click((e) => {
					//IF THE GAME IS INITIALIZED, LOAD STATE
					if (window.game) window.game.loadState($(e.target).data("loadnum"));
					//IF NOT, START THE GAME WITH THE RIGHT CHAPTER AND LOAD STATE
					else {
						//INITIALIZE GAME WITH THE RIGHT CHAPTER
						startGameFromChapter($(e.target).data("chapter"));
						//LOAD THE SAVE STATE
						window.game.loadState($(e.target).data("loadnum"));
					}
				});
			});
			//GENERATE SAVE BUTTONS
			for (var i = 0; i < $(".imm_inner").find('.i_slot').length; i++) {
				$(`.smm_slot_` + i).append(`<button class="act_save act_s_${i}" data-savenum="${i}"><span>${window.lang_dict.slot}</span> ${i}</button>`);

				$(`.act_save.act_s_` + i).click((e) => {
					if ($(e.target).siblings('img').length) {
						new customPrompt({
							text: window.lang_dict.overwrite_confirm,
							options: [
								{ "text" : window.lang_dict.sure, "value" : true },
								{ "text" : window.lang_dict.nope, "value" : false }
							],
							default: false,
							callback: (pt_e) => {
								if (pt_e) {
									window.game.saveState($(e.target).data("savenum"), () => {
										$(".save_menu").hide();
										this.genSaves();
									});
								}
							}
						});
					}
					else{
						window.game.saveState($(e.target).data("savenum"), () => {
							$(".save_menu").hide();
							this.genSaves();
						});
					}
				});
			}
		});
	}
	genSaves(){
		//CHECK IF SAVES DIR EXISTS
		fs.access(this.saveDir, error => {
		    if (error){
		    	//CREATE SAVES DIR IF NOT EXISTS
		        fs.mkdir(this.saveDir, (err) => {
				    if (err) throw err;
				    this.parseSaves();
				});
		    }
		    else this.parseSaves(); 
		});
	}
}

function startGameFromChapter(chap_id) {
	//CREATE NEW GAME INSTANCE FROM SELECTED CHAPTER ENTRY FILE
	window.game = new gameManager({
		chapter: chap_id,
		actionSet: window.chapterList.find(x => x.id === chap_id).entry,
		locale: window.appSettings.locale
	});

	window.game.startGame();
}

//LOAD PRIMARY GAME SCRIPT
$(document).on("langload", function(){
	//LOAD CHARACTER DATA FROM APPROPRIATE LOCALE
	var charData = require(path.join(__dirname, `/game_data/${window.appSettings.locale}/data/characters.json`));
	//CREATE A CHARACTER LIST WITH THE LOADED CHARDATA
	window.charlist = new charList(charData);

	//CREATE A NEW SAVE MANAGER
	window.saveManager = new saveManager();
	
	$(".main_play").click(function(e){
		e.stopPropagation();
		//IF SKIP CHAPTER IS ENABLED, START THE FIRST AVAILABLE CHAPTER
		if (window.chapterList.length < 2 && window.identity.skip_single_chapter) startGameFromChapter($(".chapter_inner").find('button').data("chid"));
		//OTHERWISE SHOW CHAPTER SELECTION
		else $(".ep_menu").show();
	});

	$(".chapter_select").click(function() { startGameFromChapter($(this).data("chid")); });

	$(".toggle_pause_js").click(function(e){
		e.stopPropagation();

		if (!window.game.paused) {
			$('.pause_menu').show();
			window.game.paused = true;
		}
		else {
			$('.pause_menu').hide();
			window.game.paused = false;
		}
	});

	$(".set_lang_button").click(function(){
		$(".set_lang_button").removeClass("selected");
		$(this).addClass("selected");
	});

	$(".settings_save").click(function(){ 
		//CHECK IF USER CHANGED LANGUAGE IN THE SETTINGS
		var localeChanged = $(".set_lang_button.selected").data("lang") != window.appSettings.locale;
		//SAVE THE CHOSEN LANGUAGE TO LOADED SETTINGS
		window.appSettings.locale = $(".set_lang_button.selected").data("lang");
        //TURN LOADED SETTINGS OBJECT INTO STRING FOR WRITING
		var data = JSON.stringify(window.appSettings);
		//WRITE THE SETTINGS TO THE SETTINGS FILE
		fs.writeFile(path.join(window.home_dir, '/settings.json'), data, function (err) {
		  	if (err) return console.log(err);
		  	//IF THE LOCALE WASN'T CHANGED, STOP
		  	if (!localeChanged) return;
		  	//IF THE LOCALE WAS CHANGED, RELOAD TO NEW LOCALE
		  	fs.readFile(path.join(__dirname, '/game_data/' + window.appSettings.locale + '/data/dict.json'), 'utf8', function (err, dictData) {
			  	if (err) return console.log(err);
			  	//SAVE LOADED DICTIONARY TO WINDOW
				window.lang_dict = JSON.parse(dictData);
				//CHANGE ALL WORDS TO THE NEW LOCALE
				window.populateLangs(window.lang_dict);
				//RELOAD THE GAME'S LANGUAGE IN THE SAME SPOT
				if (window.game) {
					if(window.game.currentChar && window.game.currentChar.dialogue) clearInterval(window.game.currentChar.dialogue.interval);
					var tempActions = requireUncached(path.join(__dirname, `/game_data/${window.appSettings.locale}/chapters/${window.game.chapter}/${window.game.actionSet}.json`));	
					for(var i = 0; i < window.game.iterator-1; i++) tempActions.shift();
					window.game.act(tempActions);
				}
			});
		});
	});

	$(".pause_quit").click(function(e){
		e.stopPropagation();
		var quitPrompt = new customPrompt({
			options: [
				{ "text" : window.lang_dict.quit_main, "value" : false },
				{ "text" : window.lang_dict.quit_desktop, "value" : true }
			],
			chain: true,
			default: false,
			callback: (e) => {
				if (e) {
					new customPrompt({
						text: window.lang_dict.quit_confirm,
						options: [
							{ "text" : window.lang_dict.sure, "value" : true },
							{ "text" : window.lang_dict.nope, "value" : false }
						],
						default: false,
						callback: (e) => { if (e) ipcRenderer.send('window', "close"); }
					});
				}
				else {
					this.paused = false;
					$(".game_contents").hide();
					$('.main_menu').show();
					quitPrompt.dismiss();
				}
			}
		});
	});

	$(".main_quit").click(function(e){
		e.stopPropagation();
		new customPrompt({
			text: window.lang_dict.quit_confirm,
			options: [
				{ "text" : window.lang_dict.sure, "value" : true },
				{ "text" : window.lang_dict.nope, "value" : false }
			],
			default: false,
			callback: (e) => { if (e) ipcRenderer.send('window', "close"); }
		});
	});

	$(".main_restart").click(function(e){
		e.stopPropagation();
		window.game.restart();
	});

	$(document).click(function(){
		if(window.game && !window.game.paused) window.game.currentChar.skipDialogue();
	});

	$(document).bind("keyup", function(e){
		$(document).trigger("keyup_skip", [e]).trigger("keyup_next", [e]);
	});

	$(document).bind("keyup_skip", function(e, event){
		if (keyEditMode) {
			$("#pick_key").html(window.lang_dict.keyNames[event.keyCode]);
            window.appSettings.skip = event.keyCode;
            return setTimeout(() => { keyEditMode = false; }, 100);
		}

		if(event.keyCode == (window.appSettings.skip || 32) && !window.game.paused && window.game.currentChar){
			if (!charlist.findChar(window.game.currentChar.pseudonym).diagComplete) {
				window.okToNext = false;
				window.game.currentChar.skipDialogue();
			}
			else window.okToNext = true;
		}
	});

	$(".toggle_page").click(function(){ $(this).parent(".page").hide(); });

	$(".open_page").click(function(){ $("." + $(this).data("page")).show(); });

	$(".ignore").click(function(e){ e.stopPropagation(); });

	$('a').click(function(e){
		if ($(this).attr("href") && $(this).attr("href").startsWith("http")) {
			e.preventDefault();
			open($(this).attr("href"));
		}
	});

	$("#pick_key").click(function(e){
		e.preventDefault();
		if (!keyEditMode){
			$(this).text("Press any key");
			keyEditMode = true;
		}
		else {
			if(window.appSettings.skip) $("#pick_key").text(window.lang_dict.keyNames[window.appSettings.skip]);
            else $("#pick_key").text(window.lang_dict.keyNames[32]);
			keyEditMode = false;
		}
	});
});

//NOTES

//objectfit still doesnt work in html2canvas as of 2/9/2020 (FIXED TEMPORARILY WITH ALIGN SELF)
//using a namespace for an event like keycode.skip makes a function bound only to .skip fire for any element in the namespace
//oktonext checks if the dialogue was recently skipped and if so disallows it to instantly go to the next slide (should work ok but keep an eye on it)


//TEMP DOCS

//this is how you setup custom input for sysvars and use them to template strings in speech

/*

   {
      "character":"sh",
      "speak":"...",
      "emote":"blank",
      "scene":"blank_white",
      "choices":[
         {
            "sysvarInput" : true,
            "sysvar":[
               {
                  "name":"charname"
               }
            ]
         }
      ]
   },
   {
      "character":"sh",
      "speak":"How are you doing {charname}",
      "speakTemplated" : true,
      "emote":"puzzled",
      "scene":"blank_white"
   },

*/