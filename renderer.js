var html2canvas = require('html2canvas');
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
		if(!actions || actions.length<1) console.log("No actions!", actions);

		if (actions[0].affected) {
			var selectSysvarResult = actions[0].sysvarResults[this.sysvars[actions[0].sysvarCheck]];

			this.currentChar = charlist.findChar(selectSysvarResult.character);
			
			this.nextMove(selectSysvarResult.character, selectSysvarResult, actions);
		}
		else{
			if (!charlist.findChar(actions[0].character)) {
				console.log("Can't find the character, returning...");
				return;
			}

			this.currentChar = charlist.findChar(actions[0].character);

			this.nextMove(actions[0].character, actions[0], actions);
		}
		this.iterator++;
	}
	nextMove(character, result, actions){
		charlist.findChar(character).do(result, () => {
			if (!actions[0].next) {
				actions.shift();
				if (actions.length>0) this.act(actions);
				else {
					$(".event_manager").unbind();
					$(document).unbind("keyup_next");
				}
			}
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
			//compress image here
			if (window.identity.compress_previews) {
				var resizeTo = {
					width: 144,
					height: 94
				};

	            var extra_canvas = document.createElement("canvas");
	            extra_canvas.setAttribute('width',resizeTo.width);
	            extra_canvas.setAttribute('height',resizeTo.height);
	            var ctx = extra_canvas.getContext('2d');
	            ctx.imageSmoothingEnabled = true;

	            drawImageProp(ctx, canvas, 0, 0, resizeTo.width, resizeTo.height);

			    gameSave.imgdata = extra_canvas.toDataURL("image/png");
			}
			else {
				gameSave.imgdata = canvas.toDataURL("image/png");
			}
		 
			var data = JSON.stringify(gameSave, null, 2);

			fs.writeFile(path.join(path.join(window.home_dir, '/saves/'), '/slot_' + pos + '.json'), data, (err) => {
				if (err) throw err;
				if (callback) callback();
			});
		});
	}
	loadState(pos, callback){
		$(".page").hide();

		$(".main_menu").hide();
		$(".pause_menu").hide();
		this.paused = false;
		$(".game_contents").show();

		fs.readFile(path.join(path.join(window.home_dir, '/saves/'), '/slot_' + pos + '.json'), (err, data) => {
			if (err) console.log(err);

			if(window.game.currentChar && window.game.currentChar.dialogue) clearInterval(window.game.currentChar.dialogue.interval);

			var fileContents = JSON.parse(data);

			var tempActions = requireUncached(path.join(__dirname, `/game_data/${window.appSettings.locale}/chapters/${fileContents.chapter}/${fileContents.actionSet}.json`));
			
			for(var i = 0; i < fileContents.iterator-1; i++) tempActions.shift();

			this.sysvars = fileContents.sysvars;
			this.actionSet = fileContents.actionSet;
			this.chapter = fileContents.chapter;
			this.iterator = fileContents.iterator-1;

			this.act(tempActions);

			if (callback) callback();
		});
	}
	restart(){
		$(".page").hide();

		$(".main_menu").hide();
		$(".pause_menu").hide();
		this.paused = false;
		$(".game_contents").show();
	
		this.actionSet =  window.chapterList.find(x => x.id === this.chapter).entry;

		this.actions = requireUncached(path.join(__dirname, `/game_data/${window.appSettings.locale}/chapters/${this.chapter}/primary_script.json`));
		this.sysvars = {};
		this.actionStep = 0;
		this.iterator = 0;
		this.act(this.actions);
	}
}
//CHARACTER INSTANCE
class character{
	constructor(args){
		if(Object.keys(args).length) {
			Object.keys(args).forEach(key => {
				this[key] = args[key];
			});
		}

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
				if (this.dialogue.callback) this.dialogue.callback();

				this.dialogue = null;
			}
		}, length);
	}
	skipDialogue(){
		if (this.dialogue && this.dialogue.running && !this.dialogue.unskippable) {
			clearInterval(this.dialogue.interval);
			$(".speech").append(this.dialogue.text.join(''));
			if (this.dialogue.callback) this.dialogue.callback();
			this.diagComplete = true;
			this.dialogue = null;
		}
	}
	guest(guest){
		return charlist.findChar(guest.character);
	}
	do(args, callback, guest = null){
		$(".speech").empty();
		$(".speech_box").hide();
		$(".name").empty();
		$(".name").hide();
		$(".character").empty();
		$(".character").hide();
		$(".choice_area").empty();
		$(".background").empty();
		$(".choice_area").addClass("inactive");

		if (args.emote) {
			var emoteURL = path.join(__dirname, 'assets', 'characters', this.dirname, this.pseudonym+'_'+args.emote+'.png');

			if (!imageCached(emoteURL)) emoteURL = path.join(__dirname, 'assets', 'img', 'dummy.png');
		
			$(".character").show();
			$(".character").append(`
				<div class="charimagewrapper ${args.flip_emote?'flipped':''}">
					<img src="${emoteURL}">
				</div>
			`);
		}

		$(".background").append(`
			<img src="${path.join(__dirname, 'assets', 'scenes', args.scene+'.png')}">
		`);

		if (this.name && !args.hideName || args.name_override) {
			if (args.name_override) $(".name").append(args.name_override);
			else $(".name").append(this.name);
			
			$(".name").show();
		}

		if (args.guest) {
			//THIS WILL NOT VALIDATE IF YOU HAVE AN UNDEFINED GUEST, BUT WHY WOULD YOU ANYWAY
			var guestEmoteURL = path.join(__dirname, 'assets', 'characters', this.guest(args.guest).dirname, this.guest(args.guest).pseudonym+'_'+args.guest.emote+'.png');

			if (!imageCached(guestEmoteURL)) guestEmoteURL = path.join(__dirname, 'assets', 'img', 'dummy.png');

			var dataToAppend = `
				<div class="charimagewrapper ${args.guest.flip_emote?'flipped':''}">
					<img src="${guestEmoteURL}">
				</div>
			`;

			if (args.guest.order == 1) $(".character").append(dataToAppend);
			else $(".character").prepend(dataToAppend);
		}

		$(".event_manager").unbind();
		$(document).unbind("keyup_next");

		function getChoices(){
			if (args.choices) {
				for (var i = 0; i < args.choices.length; i++) {
					$(".choice_area").append(`<button class="choice_${i}">${args.choices[i].option}</button>`);

					(function (num) {
						$(`.choice_${i}`).click(() => {
							if (args.choices[num].sysvar) {
								for (var j = 0; j < args.choices[num].sysvar.length; j++) {
									window.game.sysvars[args.choices[num].sysvar[j].name] = args.choices[num].sysvar[j].value; 
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
								if(callback) callback();
							}
						});
					})(i);
				}
				$(".choice_area").removeClass("inactive");
			}
			else { 
				if(callback) {
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
					if(callback) callback();
				}, args.wait);
			}
			else getChoices();
		}
		else{
			$(".speech_box").show();
			this.typeOut(args.speak, args.unskippable, getChoices, args.typeTime);
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
		this.args = args;

		$(".confirm_page").find(".confirm_prompt").empty().append(args.text);

		$(".confirm_page").find(".confirm_choices").empty();

		$(".confirm_page").find(".toggle_page").click(function(){
			args.callback(args.default);
		});

		for (var i = 0; i < args.options.length; i++) {
			(function(i){
				var $btn = $("<button>", { type: 'button', text: args.options[i].text});

				$btn.click(() => {
					args.callback(args.options[i].value);

					$(".confirm_page").hide();
				});

				$(".confirm_page").find(".confirm_choices").append($btn);
			})(i);
		}

		this.showPrompt();
	}
	showPrompt(){
		$(".confirm_page").show();
	}
}

function generateGameObject(data) {
	window.game = new gameManager(data);
}

function startGameFromChapter(chap_id) {
	console.log("ENTRY", window.chapterList.find(x => x.id === chap_id).entry);
	//CREATE NEW GAME INSTANCE FROM SELECTED CHAPTER ENTRY FILE
	generateGameObject({
		chapter: chap_id,
		actionSet: window.chapterList.find(x => x.id === chap_id).entry,
		locale: window.appSettings.locale
	});
	//PREVENT ACCIDENTAL DOUBLE SELECTION WITH A SKIP KEY
	if (!window.game.paused) return;
	//START GAME AND UNPAUSE THE DEFAULT GAME INSTANCE
	window.game.paused = false;
	//HIDE MAIN MENU
	$('.main_menu').hide();
	//FADE OUT THE CHAPTER MENU SLOWLY
	$('.ep_menu').fadeOut('slow', function() {
		//DRAW THE SCENE
		$(".game_contents").show();
		//RUN FIRST SLIDE IN CHAPTER
		window.game.act(window.game.actions);
	});
}

//LOAD PRIMARY GAME SCRIPT
$(document).on("langload", function(){
	//LOAD CHARACTER DATA FROM APPROPRIATE LOCALE
	var charData = require(path.join(__dirname, `/game_data/${window.appSettings.locale}/data/characters.json`));
	//CRATE A CHARACTER LIST WITH THE LOADED CHARDATA
	window.charlist = new charList(charData);
	
	function parseSaves(pathSaves){
		fs.readdir(pathSaves, (err, files) => {
			files.forEach(file => {
				var slotNum = path.basename(file, '.json').split("_")[1];

				var grabPreview = requireUncached(path.join(pathSaves, file));
	
				$(`.lmm_slot_` + slotNum).empty();
				$(`.smm_slot_` + slotNum).empty();

				if (grabPreview.imgdata) {
					$(`.lmm_slot_` + slotNum).append(`<img class="i_slot_preview" src="${grabPreview.imgdata}">`);
					$(`.smm_slot_` + slotNum).append(`<img class="i_slot_preview" src="${grabPreview.imgdata}">`);
				}
	
				$(`.lmm_slot_` + slotNum).append(`<button class="act_load act_l_${slotNum}" data-loadnum="${slotNum}">${window.lang_dict.slot} ${slotNum}</button>`);
	
				$(`.act_load.act_l_` + slotNum).click(function(){
					//TEMPORARY FIX FOR LACK OF CHAPTER DATA WHEN LOADING
					if (window.game) window.game.loadState($(this).data("loadnum"));
					else fs.readFile(path.join(path.join(window.home_dir, '/saves/'), '/slot_' + $(this).data("loadnum") + '.json'), (err, data) => {
						var fileContents = JSON.parse(data);
						startGameFromChapter(fileContents.chapter);

						window.game.loadState($(this).data("loadnum"));
					});
				});

			});

			for (var i = 0; i < $(".imm_inner").find('.i_slot').length; i++) {
				$(`.smm_slot_` + i).append(`<button class="act_save act_s_${i}" data-savenum="${i}"><span>${window.lang_dict.slot}</span> ${i}</button>`);

				$(`.act_save.act_s_` + i).click(function(){
					if ($(this).siblings('img').length) {
						new customPrompt({
							text: window.lang_dict.overwrite_confirm,
							options: [
								{
									"text" : window.lang_dict.sure,
									"value" : true
								},
								{
									"text" : window.lang_dict.nope,
									"value" : false
								}
							],
							default: false,
							callback: (e) => {
								if (e) {
									window.game.saveState($(this).data("savenum"), function(){
										genSaves(path.join(window.home_dir, '/saves/'));

										$(".save_menu").hide();
									});
								}
							}
						});
					}
					else{
						window.game.saveState($(this).data("savenum"), function(){
							genSaves(path.join(window.home_dir, '/saves/'));

							$(".save_menu").hide();
						});
					}
				});
			}
		});
	}

	function genSaves(pathSaves){
		fs.access(pathSaves, error => {
		    if (error){
		        fs.mkdir(pathSaves, (err) => {
				    if (err) throw err;

				    parseSaves(pathSaves);
				});
		    }
		    else parseSaves(pathSaves); 
		});
	}
	
	genSaves(path.join(window.home_dir, '/saves/'));
	
	$(".main_play").click(function(e){
		e.stopPropagation();

		if (window.chapterList.length < 2 && window.identity.skip_single_chapter) {
			//should this get the data value instead of simulating a click?
			$(".chapter_inner").find('button').first().click();
			return;
		}

		$(".ep_menu").show();
	});

	$(".chapter_select").click(function() {
		startGameFromChapter($(this).data("chid"));
	});

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
		window.appSettings.locale = $(".set_lang_button.selected").data("lang");
                
		var data = JSON.stringify(window.appSettings);
		fs.writeFileSync(path.join(window.home_dir, '/settings.json'), data);
		
		var dictData = fs.readFileSync(path.join(__dirname, '/game_data/' + window.appSettings.locale + '/data/dict.json'));
		window.lang_dict = JSON.parse(dictData);

		window.populateLangs(window.lang_dict);
		
		if(window.game.currentChar && window.game.currentChar.dialogue) clearInterval(window.game.currentChar.dialogue.interval);

		var tempActions = requireUncached(path.join(__dirname, `/game_data/${window.appSettings.locale}/chapters/${window.game.chapter}/${window.game.actionSet}.json`));
				
		for(var i = 0; i < window.game.iterator-1; i++) tempActions.shift();

		window.game.act(tempActions);
	});

	$(".main_quit").click(function(e){
		e.stopPropagation();

		new customPrompt({
			text: window.lang_dict.quit_confirm,
			options: [
				{
					"text" : window.lang_dict.sure,
					"value" : true
				},
				{
					"text" : window.lang_dict.nope,
					"value" : false
				}
			],
			default: false,
			callback: (e) => {
				if (e) remote.getCurrentWindow().close();
			}
		});
	});

	$(".main_restart").click(function(e){
		e.stopPropagation();

		window.game.restart();
	});

	$(document).click(function(){
		if(window.game && !window.game.paused){
			window.game.currentChar.skipDialogue();
		}
	});

	$(document).bind("keyup", function(e){
		$(document).trigger("keyup_skip", [e]);
		$(document).trigger("keyup_next", [e]);
	});

	$(document).bind("keyup_skip", function(e, event){
		if (keyEditMode) {
			$("#pick_key").html(window.lang_dict.keyNames[event.keyCode]);

            window.appSettings.skip = event.keyCode;

            setTimeout(() => {
				keyEditMode = false;
				return;
            }, 100);
		}
		if(event.keyCode == (window.appSettings.skip || 32) && !window.game.paused && window.game.currentChar){
			if (!charlist.findChar(window.game.currentChar.pseudonym).diagComplete) {
				window.okToNext = false;
				window.game.currentChar.skipDialogue();
			}
			else{
				window.okToNext = true;
			}
		}
	});

	$(".toggle_page").click(function(){
		$(this).parent(".page").hide();
	});

	$(".open_page").click(function(){
		$("." + $(this).data("page")).show();
	});

	$(".ignore").click(function(e){
		e.stopPropagation();
	});

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
	});
});

//TODO

//fix the unnecessarily overengineered loading saves code
//add characterless dialogue (fullscreen reading, etc bs)
/*at some point the dialogue gets assigned to the character instance in the game object, instead of the character instance in the charlist object, which is an error because the character instance in the game object is just a pseudonym supposedly*/

//NOTES

//objectfit still doesnt work in html2canvas as of 2/9/2020 (FIXED TEMPORARILY WITH ALIGN SELF)
//using a namespace for an event like keycode.skip makes a function bound only to .skip fire for any element in the namespace
//oktonext checks if the dialogue was recently skipped and if so disallows it to instantly go to the next slide (should work ok but keep an eye on it)