/*
*	 Events:
		git-clone						// The user has a git clone. Recommend use the "git pull" command
		check-up-to-date ( v )			// versions match
		check-out-dated	( v_old , v)	// versions dont match
		update-downloaded				// Update downloaded in the machine
		update-not-installed			// Update was already in the dir, so it wasnt installed
		extracted						// The update has been extracted correctly.
		download-start ( name )			// The download of "name of the update" has started
		download-update ( name , % )	// The download has been updated. New percentage
		download-end ( name )			// The download has ended
		download-error ( err )			// Something happened to the download
		end 							// Called when all is over ( along with 'check-up-to-date' if there are no updates, or with 'extracted' if it was installed )

	Public Methods:
		init ( opc )
			pathToJson: ''			// from repo main folder to package.json (only subfolders. Can't go backwards)
			async: true 			// Currently not sync supported.
			silent: false			// Does not trigger events
			autoupdate: false		// if true, all stages run one after the other. else, force stages with public methods
			check_git: true			// Checks if the .git folder exists, so its a dev and doesnt download the proyect.
		
		on ( event, callback )		// Sets the events
		
		checkDependencies()			// Return bool if client has all the remote dependencies. Undefined if they weren't checked yet (need forceCheck first)

		forceCheck ()
		forceDownloadUpdate()
		forceExtract()
*
*
*/

var fs = require('fs'),
	https = require('https');

module.exports = function( opciones ){
	
	function AutoUpdater() {
		this.eventCallbacks;
		this.jsons;
		this.opc;
		this.update_dest;
		this.updateName;
		this.cache;
	};

	AutoUpdater.init = function(opciones){
		this.eventCallbacks = new Array();
		this.jsons = new Array();
		this.opc = new Array();
		this.update_dest = 'update';
		this.cache = new Array();

		this.opc.pathToJson = (opciones != null && opciones.pathToJson != null && opciones.pathToJson != undefined ) ? (opciones.pathToJson) : "";
		this.opc.async = true;//(opciones != null && opciones.async == false) ? false : true; // No support for http response sync.
		this.opc.silent = ( opciones && opciones.silent ) || false; // No advierte eventos
		this.opc.autoupdate = (opciones != null && opciones.autoupdate == true) ? true : false; // Descarga automáticamente la nueva versión
		this.opc.check_git = (opciones && opciones.check_git == false ) ? false : true;
		//this.opc.autocheck = (opciones.autocheck == false) ? false : true; // Revisa al inicializarse. No da tiempo a setear los eventos
	};

	AutoUpdater.forceCheck = function(){
		var self = this;

		// CheckGit
		if ( this.opc.check_git && this._checkGit() ) return;

		this._loadClientJson();
	};

	AutoUpdater.forceDownloadUpdate = function(){
		var self = this;
		this._remoteDownloadUpdate( this.updateName , { host:'codeload.github.com' , path:this.jsons.client["auto-updater"].repo + '/zip/' + this.jsons.client["auto-updater"].branch },
			function(existed){
				if ( existed === true )
					self._callBack('update-not-installed');
				else
					self._callBack('update-downloaded');
				
				if ( self.opc.autoupdate ) self.forceExtract();
			});
	};

	AutoUpdater.forceExtract = function() {
		var admzip = require('adm-zip');

		var zip = new admzip(this.updateName);
	    var zipEntries = zip.getEntries(); // an array of ZipEntry records

	    zip.extractEntryTo(zipEntries[0],'./TMP',false,true);
	    fs.unlinkSync(this.updateName); // delete installed update.

	    this._callBack('extracted');
	    this._callBack('end');
	};

	AutoUpdater.on = function( evento , callback ){
		if ( this.opc.async ) this.eventCallbacks[evento] = callback;
	};

	AutoUpdater._checkGit = function(){
		if ( this.cache.git === undefined ) {
			this.cache.git = fs.existsSync(".git");
			if ( this.cache.git === true ) this._callBack('git-clone');
		}
		return this.cache.git;
	};

	AutoUpdater._loadClientJson = function(){
		var path = this.opc.pathToJson + "./package.json",
			self = this;
		
		if ( ! this.opc.async ) { // Sync
			//console.log("Syncrono");
			this.jsons.client = JSON.parse(fs.readFileSync(path));
			this._loadRemoteJson();
		} else { // Async
			//console.log("Asyncrono");
			fs.readFile(path, function (err, data) {
				if (err) throw err;
				self.jsons.client = JSON.parse(data);
				self._loadRemoteJson();
			});
		}
	};

	AutoUpdater._loadRemoteJson = function(){
		var self = this,
			path = this.jsons.client["auto-updater"].repo + '/' + this.jsons.client["auto-updater"].branch + '/' + this.opc.pathToJson + 'package.json' ;

		this._remoteDownloader({host:'raw.github.com',path:path},function(data){
			self.jsons.remote = JSON.parse(data);
			self.updateName = self.update_dest + "-" + self.jsons.remote.version + '.zip';
			self._loaded();
		});
	};

	AutoUpdater._loaded = function(){
		if ( this.jsons.client.version == this.jsons.remote.version ) {
			this._callBack('check-up-to-date',this.jsons.remote.version);
			this._callBack('end');
		} else {
			this._callBack('check-out-dated',this.jsons.client.version,this.jsons.remote.version);
			if ( this.opc.autoupdate ) this.forceDownloadUpdate();
		}
	};

	AutoUpdater._callBack = function(evnt , p1,p2){
		if ( this.opc.silent ) return;
		var evento = this.eventCallbacks[evnt];
		if ( evento != null && evento != undefined ) evento(p1,p2);
	};

	AutoUpdater._remoteDownloader = function(opc,callback){
		var self = this;

		if ( opc.host == null || opc.host == undefined ) return;
		if ( opc.path == null || opc.path == undefined ) return;
		opc.method = ( opc.method == null || opc.method == undefined ) ? 'GET' : opc.method;
		
		var reqGet = https.request(opc, function(res) {
			data = "";
			res.on('data', function(d) { data = data + d; });
			res.on('end',function(){ callback(data); });
		});
		reqGet.end();
		reqGet.on('error', function(e) { self._callBack('download-error',e); });
	};

	AutoUpdater._remoteDownloadUpdate = function( name, opc, callback ){
		var self = this;
		
		// Ya tengo el update. Falta instalarlo.
		if ( fs.existsSync(name)) {
			callback(true);
			return;
		}

		// No tengo el archivo! Descargando!!
		var reqGet = https.get(opc, function(res) {
			if ( fs.existsSync("_"+name)) fs.unlinkSync("_"+name); // Empiezo denuevo.
		    
			self._callBack('download-start',name);

		    var file = fs.createWriteStream("_"+name),
		    	len = parseInt(res.headers['content-length'], 10),
		    	current = 0;

		    res.on('data', function(chunk) {
		    		file.write(chunk);
		    		current += chunk.length;
		    		perc = ( 100.0 * (current/len) ).toFixed(2);
		    		self._callBack('download-update',name,perc);
		        }).on('end', function() {
		        	self._callBack('download-end',name);
		        	
		        	file.end();
		        	fs.renameSync("_"+name, name);
		            
		            // Call callback
		            callback();
		        });
		});
		reqGet.on('error', function(e) { self._callBack('download-error',e); });
	};

	AutoUpdater.checkDependencies = function(){ // return Bool
		if ( this.cache.dependencies === undefined ) {
			if ( this.jsons.client != undefined && this.jsons.remote != undefined ) // ret undefined. No idea
				if ( this.jsons.client.dependencies.length != this.jsons.remote.dependencies.length ) this.cache.dependencies = false;
				else {
					for ( key in this.jsons.remote.dependencies ) // Itero sobre las remotas. Si tengo demás en cliente, no es critico
						if ( this.jsons.remote.dependencies[key] != this.jsons.client.dependencies[key] ) { // Si no existe, tmb error
							this.cache.dependencies = false;
							return false;
						};
					this.cache.dependencies = true;
				}
		}		
		return this.cache.dependencies;
	};

	// Run:
	AutoUpdater.init(opciones);

	return AutoUpdater;
};