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

## The scenes

### TODO:
- finish docs lol
