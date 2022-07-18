
# Engine documentation
## Preface

It has recently occurred to me that the engine is now in the state where it can be used to create a complete, albeit rudimentary game. Additionally, several features have been added to the engine, but haven't been used in the current storyline -- thus making them undocumented and hidden from a potential developer. As such, I decided to write some documentation for anyone who decides to give developing a game with this engine a hand. Good luck.

### Warning:

This project is still in active, albeit slow development, which means that some parts of this documentation may be incomplete or deprecated. If you have any questions, create an issue on GitHub, or contact me directly.


## The basics

The engine is designed to completely separate the code for the storyline, and the engine code itself, thus somewhat abstracting the developer from the difficult part. To simplify the process enough to where a developer wouldn't need a visual editor to create a game, I've opted to use JSON arrays to represent game data. For example, every scene is a JSON object in an array within a file and every file represents a branch in your story.

Story branches are grouped by chapter directories, which are in turn grouped by locale directories. Every locale directory carries a supplementary data directory, which contains a list of characters and a dictionary for UI elements.

Here is what your directory structure should look like:

```
/game_data
   /en
      /chapters
         /chapter_1
            primary_script.json
   /data
      characters.json
      dict.json
```
The entry file a.k.a. the starting branch should always be named `primary_script.json`. You can create as many additional script files (branches) in your `chapters` directory as you would like. 

## Scenes

Each scene is a JSON object with properties that dictate how it displays on the screen.

`character` : this prop contains the pseudonym that you assigned to a character in your `characters.json` file. This allows the engine to use data assigned to said character, such as it's name and the directory which contains the sprites.

`speak` : this prop contains text that will appear in the textbox at the bottom of the screen. Additionally, you can include system variables in text by wrapping them in curly braces.

`speakTemplated` : if set to true, this prop will allow the engine to replace references to system variables with their values in the text you wrote for the `speak` property.

`emote` :  this prop references the character sprite which will be displayed on the screen.

`scene` : this prop references the background image which will be displayed on the screen.

`choices` : this prop should contain an array of choices.

`affected` : when set to true, indicates that the scene should reference a system variable before displaying.

`sysvarCheck` : this prop contains the name of the system variable to reference.

`sysvarResults` : this prop contains an object with properties that represent the value of the referenced system variable. Each property contains the normal scene properties. If one of the properties of `sysvarResults` matches, the properties within it will be the ones used for the scene.

## Choices

Each choice is a JSON object with properties that dictate how it displays on the screen. Additionally, choices are used to stitch together different scripts (branches) and to set system variables.

`option` : this property represents the text that displays on a button, if the choice is a button.

`sysvarInput` : if set to true, this property makes the choice use a text input for a system variable value.

`next` : this property represents the name of the script that will be loaded after the choice is selected.

`sysvar` : this property is an array of system variables.

## System variables

Each system variable is an object with properties that represents a variable that you can use for the purposes of tracking the choices the player has made throughout the game.

`name` : the name of the system variable that can later be used to reference the variable in a script.

`value` : the value that will be assigned to a system variable, should the choice its attached to be selected. Does not need to be set if the choice has `sysvarInput` set to true.

### TODO:
- finish docs lol
