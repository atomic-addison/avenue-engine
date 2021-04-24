const remote = require('electron').remote;

var fs = require('fs');
var path = require('path');
var os = require("os");

document.addEventListener("keydown", function (e) {
    if (e.which === 123) {
        remote.getCurrentWindow().toggleDevTools();
    } else if (e.which === 116) {
        location.reload();
    }
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

$(document).ready(function () {
    var intro_randomnbr = $('.nbr');
    var intro_timer= 10;
    var intro_it;
    var intro_data = 0;
    var intro_index;
    var intro_change;
    var intro_letters = "source.dog".split("");
    var final_arr = [];
    window.introComplete = false;

    intro_randomnbr.each(function(){
        intro_change = Math.round(Math.random()*100);
        $(this).attr('data-change', intro_change);
    });

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

    intro_it = setInterval(intro_value, intro_timer);

    setTimeout(function(){
        $(".game_intro").addClass("blackedout");

        var loadingInterval = setInterval(function(){
            if (window.introComplete && window.loadingComplete) {
                clearInterval(loadingInterval);

                setTimeout(function(){

                    $(".game_intro").fadeOut("slow", function() {
                        //intro screen gone
                    });
                }, 500);
            }
        }, 500);

    }, $(".game_intro").data("duration"));

    window.home_dir = path.join(os.homedir(), "/.avenue/");

    if (!fs.existsSync(window.home_dir)) fs.mkdirSync(window.home_dir);

    if (!fs.existsSync(path.join(window.home_dir, "/settings.json"))) window.appSettings = {};
    else{
        var loadedData = fs.readFileSync(path.join(window.home_dir, "/settings.json"));
        window.appSettings = JSON.parse(loadedData);
    }

    async function listDirectories(rootPath) {
        const fileNames = await fs.promises.readdir(rootPath);
        const filePaths = fileNames.map(fileName => path.join(rootPath, fileName));
        const filePathsAndIsDirectoryFlagsPromises = filePaths.map(async filePath => ({path: filePath, isDirectory: (await fs.promises.stat(filePath)).isDirectory()}))
        const filePathsAndIsDirectoryFlags = await Promise.all(filePathsAndIsDirectoryFlagsPromises);

        return filePathsAndIsDirectoryFlags.filter(filePathAndIsDirectoryFlag => filePathAndIsDirectoryFlag.isDirectory)
            .map(filePathAndIsDirectoryFlag => filePathAndIsDirectoryFlag.path);
    }

    listDirectories(path.join(__dirname, '/game_data/')).then(function(e){
        for (var i = 0; i < e.length; i++) {
            var langCode = path.basename(e[i]);

            $(".lang_inner").append(`
                <button class="lang" data-lang="${langCode}">
                    <img class="flag" src="./game_data/${langCode}/data/flag.jpg">
                    ${langCode.toUpperCase()}
                </button>
            `);
            $(".locale_buttons").append(`<button class="set_lang_button selected" data-lang="${langCode}">${langCode.toUpperCase()}</button>`);
        }

        if(!window.appSettings.locale){
            $(".first_time_locale").show();
            $(".main_menu").hide();

            window.loadingComplete = true;

            $(".lang").click(function(){
                $(".first_time_locale").hide();
                $(".main_menu").show();
        
                window.appSettings.locale = $(this).data("lang");
                    
                var data = JSON.stringify(window.appSettings);
                fs.writeFileSync(path.join(window.home_dir, "/settings.json"), data);
                
                var dictData = fs.readFileSync(path.join(__dirname, '/game_data/' + window.appSettings.locale + '/data/dict.json'));
                window.lang_dict = JSON.parse(dictData);
        
                window.populateLangs(window.lang_dict);

                if(window.appSettings.skip) $("#pick_key").text(window.lang_dict.keyNames[window.appSettings.skip]);
                else $("#pick_key").text(window.lang_dict.keyNames[32]);
        
                $(document).trigger('langload',[true]);
            });
        }
        else{
            var dictData = fs.readFileSync(path.join(__dirname, '/game_data/' + window.appSettings.locale + '/data/dict.json'));
            window.lang_dict = JSON.parse(dictData);

            window.populateLangs(window.lang_dict);

            $(".first_time_locale").hide();
            $(".main_menu").show();

            if(window.appSettings.skip) $("#pick_key").text(window.lang_dict.keyNames[window.appSettings.skip]);
            else $("#pick_key").text(window.lang_dict.keyNames[32]);

            window.loadingComplete = true;
            
            $(document).trigger('langload',[true]);
        }
    });
});