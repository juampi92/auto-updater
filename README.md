# Auto-Updater

[Node.js](http://nodejs.org/) auto-update plugin.

# Installation
	
With [npm](http://npmjs.org) do:

    $ npm install auto-updater

# What does it do?

 * Compares local version with remote version.
 * If versions dont match, it downloads the repository.
 * It extracts the repository, overwriting the modifies files.

# Events

 * `git-clone` The user has a git clone. Recommend use the "git pull" command
 * `check-up-to-date ( v )` versions match
 * `check-out-dated ( v_old , v)` versions dont match
 * `update-downloaded` Update downloaded in the machine
 * `update-not-installed` Update was already in the dir, so it wasnt installed
 * `extracted` The update has been extracted correctly.
 * `download-start ( name )` The download of "name of the update" has started
 * `download-update ( name , % )` The download has been updated. New percentage
 * `download-end ( name )` The download has ended
 * `download-error ( err )` Something happened to the download
 * `end` Called when all is over ( along with 'check-up-to-date' if there are no updates, or with 'extracted' if it was installed )

# Public Methods:

 * `init ( opc )`
   * `pathToJson: ''` from repo main folder to package.json (only subfolders. Can't go backwards)
   * `async: true` Currently not sync supported.
   * `silent: false` Does not trigger events
   * `autoupdate: false` if true, all stages run one after the other. Else, you need to force the stages with the force methods
   * `check_git: true` Checks if the .git folder exists, so its a dev and doesnt download the proyect.


 * `on ( event, callback )`


 * `forceCheck ()` Compares the two versions. Triggers: 'git-clone','check-up-to-date','check-out-dated'
 * `forceDownloadUpdate()` Downloads the update. Triggers: 'update-downloaded','update-not-installed','download-*'
 * `forceExtract()` Extracts (or installs) the update reeplacing old files (it doesnt delete untracked files). Triggers: 'extracted'

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
	var autoupdater = require('./lib/auto-updater.js')({
		pathToJson: '',
		async: true,
		silent: false,
		autoupdate: false,
		check_git: true
	});

	// State the events
	autoupdater.on('git-clone',function(){
	  console.log("You have a clone of the repository. Use 'git pull' to be up-to-date");
	});
	autoupdater.on('check-up-to-date',function(v){
	  console.log("You have the latest version: " + v);
	});
	autoupdater.on('check-out-dated',function(v_old , v){
	  console.log("Your version is outdated. "+v_old+ " of "+v);
	  autoupdater.forceDownloadUpdate(); // If autoupdate: false, you'll have to do this manually.
	  // Maybe ask if the'd like to download the update.
	});
	autoupdater.on('update-downloaded',function(){
	  console.log("Update downloaded and ready for install");
	  autoupdater.forceExtract(); // If autoupdate: false, you'll have to do this manually.
	});
	autoupdater.on('update-not-installed',function(){
	  console.log("The Update was already in your folder! It's read for install");
	  autoupdater.forceExtract(); // If autoupdate: false, you'll have to do this manually.
	});
	autoupdater.on('extracted',function(){
	  console.log("Update extracted successfully!");
	});
	autoupdater.on('download-start',function(name){
	  console.log("Starting downloading: " + name);
	});
	autoupdater.on('download-update',function(name,perc){
	  process.stdout.write("Downloading " + perc + "% \033[0G");
	});
	autoupdater.on('download-end',function(name){
	  console.log("Downloaded " + name);
	});
	autoupdater.on('download-error',function(err){
	  console.log("Error when downloading: " + err);
	});
	autoupdater.on('end',function(){
	  console.log("The app is ready to function");
	});

	// Start checking
	autoupdater.forceCheck();
```

# Dependencies
 * [Adm-zip](https://github.com/cthackers/adm-zip)