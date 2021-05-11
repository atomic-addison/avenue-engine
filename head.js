window.remote = require('electron').remote;
window.fs = require('fs');
window.path = require('path');
var os = require("os");
const glob = require("glob");

window.loadedImages = [];
window.imageList = [];

document.addEventListener("keydown", function (e) {
    if (e.which === 123) remote.getCurrentWindow().toggleDevTools();
    else if (e.which === 116) location.reload();
});

window.populateLangs = (dict) => {
    if(Object.keys(dict).length) {
        Object.keys(dict).forEach(key => {
            $(`[data-dict="${key}"]`).text(dict[key]);
        });
    }

    $(".set_lang_button").removeClass("selected");
    $(`.set_lang_button[data-lang="${window.appSettings.locale}"]`).addClass("selected");
}

window.cacheSettings = function(callback) {
    var settingsString = JSON.stringify(window.appSettings || '{}', null, 2);
    fs.writeFile(path.join(window.home_dir, "/settings.json"), settingsString, (err) => {
        if (err) throw err;

        if (callback && typeof callback === "function") callback({});
    });
}

var getDirectories = function (src, callback) { glob(src + '/**/*.*', callback); };
var getChapters = function (src, callback) { glob(src + '/**/meta.json', callback); };

$(document).ready(function () {
    //READ DEFAULT APP IDENTITY FILE
    fs.readFile(path.join(__dirname, 'identity.json'), (err, data) => {
        if (err) throw err;
        //LOAD ENGINE DEFAULTS
        window.identity = JSON.parse(data);

        window.home_dir = path.join(os.homedir(), `/.${window.identity.homedir}/`);

        //SET IDENTITY TITLE
        document.title = window.identity.window_title;

        //SET GAME VERSION
        $(".game_version").text(window.identity.version);

        var intro_timer = 10;
        var intro_it;
        var intro_data = 0;
        var intro_index;
        var intro_change;
        var intro_letters = window.identity.studio.split("");
        //GENERATE PLACEHOLDER CELLS FOR THE TITLE
        $(".intro_random").empty();
        for (var i = 0; i < intro_letters.length; i++) $(".intro_random").append(`<span class="nbr ltr">0</span>`);
        var final_arr = [];
        window.introComplete = false;
        var intro_randomnbr = $('.nbr');

        intro_randomnbr.each(function(){
            intro_change = Math.round(Math.random()*100);
            $(this).attr('data-change', intro_change);
        });

        window.requireUncached = function(module) {
            delete require.cache[require.resolve(module)];
            return require(module);
        }

        function intro_random(){ return Math.round(Math.random()*9); }

        function intro_select(){ return Math.round(Math.random()*intro_randomnbr.length+1); }

        function intro_value(){
            $('.nbr:nth-child('+intro_select()+')').html(''+intro_random()+'');
            $('.nbr:nth-child('+intro_select()+')').attr('data-number', intro_data);
            intro_data++;

            final_arr = [];

            intro_randomnbr.each(function(index, elem){
                if(parseInt($(this).attr('data-number')) > parseInt($(this).attr('data-change'))){
                    intro_index = $('.ltr').index(this);
                    $(this).html(intro_letters[intro_index]);
                    $(this).removeClass('nbr');
                }

                final_arr.push($(this).text());
            });

            if (final_arr.join("") == intro_letters.join("")) {
                clearInterval(intro_it);
                window.introComplete = true;
            }
        }

        function ensureDirectory(directory, callback) {
            fs.access(directory, error => {
                if (!error) {
                    // The check succeeded
                    if (callback && typeof callback === "function") callback();
                } else {
                    // The check failed
                    fs.mkdir(directory, { recursive: true }, (err) => {
                        if (err) throw err;

                        if (callback && typeof callback === "function") callback();
                    });
                }
            });
        }

        function ensureSettings(directory, callback) {
            fs.access(path.join(directory, 'settings.json'), error => {
                if (!error) {
                    // The check succeeded
                    fs.readFile(path.join(directory, 'settings.json'), (err, data) => {
                        if (err) throw err;

                        var settingsData = JSON.parse(data==''?'{}':data);
                        if (callback && typeof callback === "function") callback(settingsData);
                    });

                } else {
                    // The check failed
                    cacheSettings(callback);
                }
            });
        }

        async function listDirectories(rootPath) {
            const fileNames = await fs.promises.readdir(rootPath);
            const filePaths = fileNames.map(fileName => path.join(rootPath, fileName));
            const filePathsAndIsDirectoryFlagsPromises = filePaths.map(async filePath => ({path: filePath, isDirectory: (await fs.promises.stat(filePath)).isDirectory()}))
            const filePathsAndIsDirectoryFlags = await Promise.all(filePathsAndIsDirectoryFlagsPromises);

            return filePathsAndIsDirectoryFlags.filter(filePathAndIsDirectoryFlag => filePathAndIsDirectoryFlag.isDirectory)
                .map(filePathAndIsDirectoryFlag => filePathAndIsDirectoryFlag.path);
        }

        window.loadDictionary = function(locale_name, callback) {
            //READ SELECTED LOCALE FILE
            fs.readFile(path.join(__dirname, '/game_data/' + locale_name + '/data/dict.json'), (err, data) => {
                if (err) throw err;
                //PARSE LOCALE FILE INTO JSON
                window.lang_dict = JSON.parse(data);
                //REPLACE ALL THE DICTIONARY CODES WITH APPROPRIATE ENTRIES
                window.populateLangs(window.lang_dict);
                //LOAD SKIP KEY NAME
                if(window.appSettings.skip) $("#pick_key").text(window.lang_dict.keyNames[window.appSettings.skip]);
                else $("#pick_key").text(window.lang_dict.keyNames[32]);
                //EXECUTE CALLBACK IF ANY
                if (callback && typeof callback === "function") callback({});
            });
        }

        function readChapterList() {
            //GET ALL AVAILABLE CHAPTERS WITH META FILES
            getChapters(path.join(__dirname, '/game_data/' + window.appSettings.locale, '/chapters/'), function (err, res) {
                window.chapterList = [];
                //LOAD ALL THE CHAPTERS INTO A LIST
                for (var i = 0; i < res.length; i++) {
                    chapterList.push(requireUncached(res[i]));

                    chapterList[chapterList.length - 1].loc = res[i];
                }
                //SORT CHAPTER LIST BY META FILE ORDER
                chapterList.sort((a, b) => (a.order > b.order) ? 1 : -1);
                //SHOW ALL THE CHAPTER OPTIONS
                for (var i = 0; i < chapterList.length; i++) {
                    $(".chapter_inner").append(`
                        <div class="chapter">
                            ${chapterList[i].preview ? `<img class="chapter_preview" src="${chapterList[i].preview}">` : ""}
                            <button class="chapter_select" data-chid="${chapterList[i].id}">${chapterList[i].name}</button>
                        </div>
                    `);
                }
                //HIDE LOCALE SCREEN AND SHOW MAIN MENU
                $(".first_time_locale").hide();
                $(".main_menu").show();
                //FINISH LOADING AND CALL THE GAME SCRIPT
                window.loadingComplete = true;
                $(document).trigger('langload',[true]);
            });
        }

        intro_it = setInterval(intro_value, intro_timer);

        setTimeout(function(){
            $(".game_intro").addClass("blackedout");

            var loadingInterval = setInterval(function(){
                if (window.introComplete && window.loadingComplete) {
                    clearInterval(loadingInterval);

                    setTimeout(function(){ $(".game_intro").fadeOut("slow"); }, 500);
                }
            }, 500);

        }, $(".game_intro").data("duration"));

        //START THE LOADING PROCESS MEANWHILE

        //PRELOAD IMAGES
        getDirectories(path.join(__dirname, '/assets/'), function (err, res) {
            if (err) return console.log(err);

            window.imageList = res;
                
            for (var i = 0; i < res.length; i++) {
                loadedImages.push((new Image()));
                loadedImages[loadedImages.length - 1].src=res[i];
            }
            //ENSURE INSTANCE HOME DIRECTORY EXISTS
            ensureDirectory(window.home_dir, function() {
                //ENSURE INSTANCE SETTINGS FILE EXISTS
                ensureSettings(window.home_dir, function(settings) {
                    window.appSettings = settings;
                    //LOAD AVAILABLE LOCALES
                    listDirectories(path.join(__dirname, '/game_data/')).then(function(e){
                        //DISPLAY AVAILABLE LOCALES
                        for (var i = 0; i < e.length; i++) {
                            var langCode = path.basename(e[i]);

                            $(".lang_inner").append(`
                                <button class="lang" data-lang="${langCode}">
                                    <img class="flag" src="./game_data/${langCode}/data/flag.jpg">
                                    ${langCode.toUpperCase()}
                                </button>
                            `);
                            $(".locale_buttons").append(`<button class="set_lang_button selected" data-lang="${langCode}">${langCode.toUpperCase()}</button>`);
                            
                            //CHECK IF A LOCALE WAS SELECTED BEFORE
                            if(!window.appSettings.locale){
                                //FINISH LOADING AND LET USER SELECT A LOCALE
                                window.loadingComplete = true;
                                //SKIP SINGLE LOCALE SELECTION IF SET IN IDENTITY SETTINGS
                                if (window.identity.skip_single_locale && e.length < 2) {
                                    //HIDE LOCALE SELECTION IN THE SETTINGS MENU
                                    $(".settings_locale").hide();
                                    window.appSettings.locale = path.basename(e[0]);
                                    //UPDATE LOCALE SELECTION IN THE SETTINGS FILE
                                    cacheSettings(function () {
                                        //LOAD SELECTED LOCALE DICTIONARY
                                        loadDictionary(window.appSettings.locale, function() {
                                            //READ THE CHAPTERS IN SELECTED LOCALE
                                            readChapterList();
                                        });
                                    });
                                }
                                else {
                                    //IF NO LOCALE IS SELECTED, SHOW LOCALE SELECTION SCREEN
                                    $(".first_time_locale").show();
                                    $(".main_menu").hide();
                                    //WAIT FOR USER TO SELECT A LOCALE
                                    $(".lang").click(function(){
                                        //SAVE LOCALE TO SETTINGS CACHE
                                        window.appSettings.locale = $(this).data("lang");
                                        //UPDATE LOCALE SELECTION IN THE SETTINGS FILE
                                        cacheSettings(function () {
                                            //LOAD SELECTED LOCALE DICTIONARY
                                            loadDictionary(window.appSettings.locale, function() {
                                                //READ THE CHAPTERS IN SELECTED LOCALE
                                                readChapterList();
                                            });
                                        });
                                    });
                                }
                            }
                            else {
                                //HIDE LOCALE SELECTION IN THE SETTINGS IF THERE IS ONE LOCALE AND SKIP IS TRUE
                                if (window.identity.skip_single_locale && e.length < 2) $(".settings_locale").hide();

                                //LOAD SELECTED LOCALE DICTIONARY
                                loadDictionary(window.appSettings.locale, function() {
                                    //READ THE CHAPTERS IN SELECTED LOCALE
                                    readChapterList();
                                });
                            }
                        }
                    });
                });
            });
        });
    });
});