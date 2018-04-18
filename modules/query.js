const gamedig = require("gamedig");
const QueryDatabase = require("./db.js").QueryDatabase;
const uniqid = require("uniqid");
const asyncJs = require("async");
//DONT USED FOR NOW... const CronJob = require("cron").CronJob;

class Query{
    constructor(config){
        this.config = {
            "interval":config.interval||360000,
            "statusInterval":config.statusInterval||21600000,
            "timeout":config.timeout||3000,//NOT USED RN..?
            "mongoConnection":config.mongoConnection||null,
            "mongoDb":config.mongoDb||"mcstat",
            "setDisabledTimeout":config.setDisabledTimeout||24*60*60*1000,
            "setDisabledWebTimeout":config.setDisabledWebTimeout||72*60*60*1000,
            "databaseConnection":config.databaseConnection||null
        };
        if(this.config.databaseConnection){
            this.db = this.config.databaseConnection;
        }
        else{
            this.db = new QueryDatabase(this.config.mongoConnection,this.config.mongoDb);
        }
    }
    _registerCronJobs(){
        this.checkCronJob = setInterval(this.doPingAll.bind(this),this.config.interval);
        this.statusCronJob = setInterval(this.doStatusCheckAll.bind(this),this.config.statusInterval);
        //RUN FIRST IMMEDIATELY.. BUT IGNORE ANY ERRORS...
        this.doPingAll();
        this.doStatusCheckAll();
    }
    static getServerQuery(ip,port){
        return new Promise((_resolve,_reject)=>{
            try{
                if(typeof ip == "string" && !isNaN(port)){
                    gamedig.query({
                        type:"minecraftpe",
                        host:ip,
                        port:port,
                    }).then(async (res)=>{
                        var d = {
                            motd:res.name.replace(/Â/gim,""),
                            playerCount:parseInt(res.raw.numplayers),
                            playerList:res.players.map((e)=>{return e.name;}),
                            maxPlayerCount:parseInt(res.raw.maxplayers),
                            serverVersion:res.raw.version,
                            plugins:res.raw.plugins
                        };
                        _resolve(d)
                    }).catch((err)=>{
                        //TO SET ERROR CODE..
                        err = new Error(err);
                        err.code=112;
                        _reject(err);
                    });
                }
                else{
                    _reject(new Error("Invalid Port or IP format..."));
                }
            }
            catch(ex){
                _reject(ex);
            }
        });
    }
    //TODO: CHECK IF PROPERLY WORKING...
    async doPingAll(){
        try{
            var activeServer = await this.db.getActiveServer();
            var queryQueue = asyncJs.queue(async (data,_callback)=>{
                try{
                    var queryResult = await Query.getServerQuery(data.ip,data.port);
                    var queryInsert = {
                        id:uniqid(),
                        serverId:data.serverId,
                        playerCount:queryResult.playerCount,
                        playerList:queryResult.playerList,
                        timestamp:new Date()
                    };
                    await Promise.all([this.db.insertQuery(queryInsert),this.db.updateServerInfoAndLastContact(data.serverId,{motd:queryResult.motd,maxPlayerCount:queryResult.maxPlayerCount,serverVersion:queryResult.maxPlayerCount,plugins:queryResult.plugins})]);
                    _callback();
                }  
                catch(ex){
                    //ERROR HERE...
                    _callback(ex);
                }             
            },5);


            activeServer.forEach((server)=>{
                queryQueue.push(server,(err)=>{
                    if(err){
                        //LOG ERROR...
                    }
                });
            });
        }
        catch(exA){
            console.error("FATAL ERROR DURING PING:");
            console.error(exA);
        }
    }
    checkIsServerOverNoContactTime(serverLastContact){
        if(new Date()-new Date(serverLastContact)>this.config.setDisabledTimeout){
            return true;
        }
        return false;
    }
    _compareDateDiffOver(din){
        return new Date()-new Date(din)>this.config.setDisabledWebTimeout;
    }
    //SHOULD BE WORKING NOW... (2018-03-27)
    checkIsServerOverNoWebContactTime(created,lastApiRequest,lastBannerRequest){
        var d = new Date();
        if(
            ((lastApiRequest||lastBannerRequest) &&
            (!this._compareDateDiffOver(lastApiRequest)||!this._compareDateDiffOver(lastBannerRequest))) ||
            (!this._compareDateDiffOver(created))
        ){
            return false;
        }
        return true;
    }

    _doStatusCheckLastContact(activeServer){
        return Promise.all(activeServer.map((server)=>{
            return new Promise(async (_rs,_rj)=>{
                if(this.checkIsServerOverNoContactTime(server.lastContact)){
                    try{
                        await this.db.setServerDisabled(server.serverId);
                        //TODO: LOG INFO MAYBE?
                        _rs();
                    }
                    catch(ex){
                        _rj(ex);
                    }
                }
            });
        }))
    }
    _doStatusCheckLastWebRequest(activeServer){
        return Promise.all(activeServer.map((server)=>{
            return new Promise(async (_rs,_rj)=>{
                if(this.checkIsServerOverNoWebContactTime(server.created,server.lastApiRequest,server.lastBannerRequest)){
                    try{
                        await this.db.setServerDisabled(server.serverId);
                        //TODO: LOG INFO MAYBE?
                        _rs();
                    }
                    catch(ex){
                        _rj(ex);
                    }
                }
            });
        }))
    }

    async doStatusCheckAll(){
        try{
            var activeServer = await this.db.getActiveServer();
            await Promise.all([this._doStatusCheckLastContact(activeServer),this._doStatusCheckLastWebRequest(activeServer)]);
        }
        catch(ex){
            console.error("FATAL ERROR WHILE CHECKING SERVER STATUS");
            console.error(ex);
            //TODO: LOG IN DB...
        }
    }
    start(){
        return new Promise(async (_resolve,_reject)=>{
            try{
                await this.db.connect();
                await this.db.loadDatabaseStructure();
                this._registerCronJobs();
                _resolve();
            }
            catch(ex){
                _reject(ex);
            }
        });
    }

    stop(){
        clearTimeout(this.checkCronJob);
        clearTimeout(this.statusCronJob);
        this.db.close();
        //MAYBE I FORGOT SOMETHING? DK
    }
}

module.exports = {
    Query:Query
}