# Auto-Updater
[![Build Status](https://travis-ci.org/juampi92/auto-updater.svg)](https://travis-ci.org/juampi92/auto-updater)[![Dependencies](https://david-dm.org/juampi92/auto-updater.svg)](https://david-dm.org/juampi92/auto-updater)

[Node.js](http://nodejs.org/) auto-update plugin.

Compares local package.json with repository package.json and if versions don't match, it downloads the latest zip and extracts it.

# Installation
	
With [npm](http://npmjs.org) do:

    $ npm install auto-updater

# What does it do?

 * Compares local version with remote version.
 * If versions don't match, it downloads the repository.
 * It extracts the repository, overwriting the modified files.
 * Compares local dependencies with remote dependencies and tells if they don't match.

# Events

 * `git-clone` The user has a git clone. Recommend use the "git pull" command
 * `check.up-to-date ( v )` versions match
 * `check.out-dated ( v_old , v)` versions dont match
 * `update.downloaded` Update downloaded in the machine
 * `update.not-installed` Update was already in the dir, so it wasnt installed
 * `update.extracted` The update has been extracted correctly.
 * `download.start ( name )` The download of "name of the update" has started
 * `download.progress ( name , % )` The download has been updated. New percentage
 * `download.end ( name )` The download has ended
 * `download.error ( err )` Something happened to the download
 * `end` Called when all is over ( along with 'check-up-to-date' if there are no updates, or with 'extracted' if it was installed )

# Public Methods:

 * `use ( config )`
 * `on ( event, callback )` Sets the events (use like [EventEmitter](https://nodejs.org/api/events.html#toc))
 * `fire ( command )` Fires a command

## Config
 * `pathToJson: ''` from repo main folder to package.json (only subfolders. Can't go backwards)
 * `autoupdate: false` if true, all stages run one after the other. Else, you need to force the stages with the force methods
 * `checkgit: true` Checks if the .git folder exists, so its a dev and doesnt download the proyect.
 * `jsonhost: 'raw.githubusercontent.com'` URL of raw remote package.json
 * `contenthost: 'codeload.github.com'` URL of full remote zip
 * `progressDebounce: 0` Debounces the 'download.progress' event (0 = disabled)
 * `devmode: false` Developer Mode. Enhances error messages using console.log

## Commands
 * `check` Compares the two versions. Triggers: 'git-clone', 'check.up-to-date', 'check.out-dated'
 * `download-update` Downloads the update. Triggers: 'update.downloaded', 'update.not-installed','download.*'
 * `extract` Extracts (or installs) the update reeplacing old files (it doesnt delete untracked files). Triggers: 'update.extracted'
 * `diff-dependencies` Returns an array of dependencies (only the names) that dont match. Returns an empty array if there's no difference. Requires the 'check' command first.

Warning: do not run this methods in other order.

# Package.json configuration
	
	"version":"0.0.1",
	"auto-updater":{
		"repo":"/github-user/github-repo",
		"branch":"master"
	}

That segment must be added to the proyect (local). It is critical that the package.json of the app you are using has a version field (so it can be compared with the remote package.json stored on github), and the auto-updater field, so it knows where to get the remote data.

# Example
```javascript
var AutoUpdater = require('auto-updater');

var autoupdater = new AutoUpdater({
    pathToJson: '',
    autoupdate: false,
    checkgit: true,
    jsonhost: 'raw.githubusercontent.com',
    contenthost: 'codeload.github.com',
    progressDebounce: 0,
    devmode: false
});

// State the events
autoupdater.on('git-clone', function() {
    console.log("You have a clone of the repository. Use 'git pull' to be up-to-date");
});
autoupdater.on('check.up-to-date', function(v) {
    console.info("You have the latest version: " + v);
});
autoupdater.on('check.out-dated', function(v_old, v) {
    console.warn("Your version is outdated. " + v_old + " of " + v);
    autoupdater.fire('download-update'); // If autoupdate: false, you'll have to do this manually.
    // Maybe ask if the'd like to download the update.
});
autoupdater.on('update.downloaded', function() {
    console.log("Update downloaded and ready for install");
    autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
});
autoupdater.on('update.not-installed', function() {
    console.log("The Update was already in your folder! It's read for install");
    autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
});
autoupdater.on('update.extracted', function() {
    console.log("Update extracted successfully!");
    console.warn("RESTART THE APP!");
});
autoupdater.on('download.start', function(name) {
    console.log("Starting downloading: " + name);
});
autoupdater.on('download.progress', function(name, perc) {
    process.stdout.write("Downloading " + perc + "% \033[0G");
});
autoupdater.on('download.end', function(name) {
    console.log("Downloaded " + name);
});
autoupdater.on('download.error', function(err) {
    console.error("Error when downloading: " + err);
});
autoupdater.on('end', function() {
    console.log("The app is ready to function");
});
autoupdater.on('error', function(name, e) {
    console.error(name, e);
});

// Start checking
autoupdater.fire('check');
```

# Dependencies
 * [Adm-zip](https://github.com/cthackers/adm-zip)
 * [underscore](https://www.npmjs.com/package/underscore)
 * [node-promise](https://www.npmjs.com/package/node-promise)
