const mongo = require("mongodb").MongoClient;
const uniqid = require("uniqid");
class Database{
    constructor(server_url,db){
        this.dbName = db||"mcstat";

        if(typeof server_url=="string"){
            this.serverUrl = server_url;
            this.connection=null;
            if(!this.serverUrl)throw new Error("Mongo Server Url required!");
        }
        else{
            //ASSUME THAT server_url is a connection when not string
            this.connection=server_url;
            this.db = this.connection.db(this.dbName);
        }
    }
    connect(){
        return new Promise((_resolve,_reject)=>{
            if(this.isConnected()){
                _reject(new Error("Server already connected!"));
            }
            else{
                mongo.connect(this.serverUrl,(err,client)=>{
                    if(err){
                        _reject(err);
                    }
                    else{
                        this.connection=client;
                        this.db=this.connection.db(this.dbName);
                        _resolve(this);
                    }
                });
            }
        });
    }
    _getOrCreateCollection(colName){
        return new Promise((_resolve,_reject)=>{
            var col = this.db.collection(colName);
            if(col){
                _resolve(col);
            }
            else{
                this.db.createCollection(colName,(err)=>{
                    if(err){
                        _reject(err);
                    }
                    else{
                        col.createIndex({serverId:1},(err)=>{
                            if(err2){
                                _reject(err2);
                            }
                            else{
                                col=this.db.collection(colname);
                                _resolve(col);
                            }
                        })
                    }
                });
            }
        });
    }
    close(){
        if(this.serverUrl){
            if(this.isConnected()){
                this.connection.close();
            }
            else{
                throw new Error("Server not connected!");
            }
        }        
    }
    isConnected(){
        if(this.connection&&this.connection.isConnected())return true;
        else return false;
    }
}

class McstatDatabase extends Database{
    constructor(...args){
        super(...args);
    }
    loadDatabaseStructure(){
        return new Promise(async (_resolve,_reject)=>{
            try{
                this.serverCollection = await this._getOrCreateCollection("server");
                this.queryCollection  = await this._getOrCreateCollection("queries");
                this.statusCollection = await this._getOrCreateCollection("status");
                _resolve();
            }
            catch(ex){
                _reject(ex);
            }
        });
    }
    getServer(serverId){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.findOne({"serverId":serverId},(err,server)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve(server);
                }
            });
        });
    }
    getServerByIpAndPort(ip,port){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.findOne({"$and":[{"ip":ip},{"port":port}]},(err,server)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve(server);
                }
            });
        });
    }
    getLastQuery(serverId){
        return new Promise((_resolve,_reject)=>{
            this.queryCollection.find({"serverId":serverId}).sort({timestamp:-1}).limit(1).toArray((err,result)=>{
                if(err){
                    _reject(err);
                }
                else{
                    if(result&&result.length==1){
                        _resolve(result[0]);
                    }
                    else{
                        _resolve(null);
                    }
                }
            });
        });
    }
}

class ApiDatabase extends McstatDatabase{
    constructor(...args){
        super(...args);
    }
    insertNewServer(serverHost,serverPort,serverInfoObject){
        return new Promise((_resolve,_reject)=>{
            var nid= uniqid();
            this.serverCollection.insertOne({
                serverId:nid,
                ip:serverHost,
                port:serverPort,
                created:new Date(),
                serverInfo:serverInfoObject,
                lastContact:null,
                lastApiRequest:null,
                lastBannerRequest:null,
                webOrigins:[],
                active:true,
                disableTimestamp:null
            },(err)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve(nid);
                }
            });
        });
    }

    

    getQueriesUntilToday(serverId,dateFrom){
        return new Promise((_resolve,_reject)=>{
            this.queryCollection.find({"$and":[{"serverId":serverId},{"timestamp":{"$gte":dateFrom}}]}).sort({"timestamp":1}).toArray((err,result)=>{
                if(err){
                    _reject(err);
                }
                else{
                    if(result&&result.length>0){
                        //DELETE INTERN ID, SO USER WONT SEE IT..
                        result.forEach((x) => {
                            delete x._id;
                        });
                        _resolve(result);
                    }
                    else{
                        _reject(new Error("No recent Queries found!"));
                    }
                }
            });
        });
    }
}

class QueryDatabase extends McstatDatabase{
    constructor(...args){
        super(...args);
    }
    //DB APIS:
    getActiveServer(){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.find({"active":true}).toArray((err,res)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve(res);
                }
            });
        });
    }
    insertQuery(queryResult){
        return new Promise((_resolve,_reject)=>{
            this.queryCollection.insertOne(queryResult,(err)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve();
                }
            });
        });
    }
    setServerDisabled(serverId){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.updateOne({"serverId":serverId},{"$set":{"enabled":false,"disableTimestamp":new Date()}},(err)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve();
                }
            });
        });
    }
    updateServerLastContact(serverId){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.updateOne({"serverId":serverId},{"$set":{"lastContact":new Date()}},(err)=>{
                if(err){
                    _reject(err)
                }
                else{
                    _resolve();
                }
            })
        });
    }
    updateServerInfoAndLastContact(serverId,serverInfoObject){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.updateOne({"serverId":serverId},{"$set":{"lastContact":new Date(),"serverInfo":serverInfoObject}},(err)=>{
                if(err){
                    _reject(err)
                }
                else{
                    _resolve();
                }
            })
        });
    }
}

class BannerDatabase extends McstatDatabase{
    //REQUIRES queryInterval as 3rd Parameter!!!
    constructor(...args){
        super(...args);
        this.config = {queryInterval:args[2]};
    }
    getBannerDataById(serverId){
        return new Promise(async (_resolve,_reject)=>{
            try{
                var [server,lastQuery] = await Promise.all([this.getServer(serverId),this.getLastQuery(serverId)]);
                if(server && lastQuery){
                    var d = {
                        motd:server.serverInfo.motd,
                        maxPlayerCount:server.serverInfo.maxPlayerCount,
                        ip:server.ip,
                        port:server.port
                    };
                    if(new Date()-lastQuery.timestamp>this.config.queryInterval*2.5){
                        d.status=false;
                    }
                    else{
                        d.status=true;
                        d.aktPlayerCount=lastQuery.playerCount;
                    }
                    _resolve(d);
                }
                else{
                    _reject(new Error("Server or Querydata not found. Please try again later..."));
                }
            }
            catch(ex){
                _reject(ex);
            }
        });
    }
}

module.exports = {
    Database:Database,
    McstatDatabase:McstatDatabase,
    ApiDatabase:ApiDatabase,
    QueryDatabase:QueryDatabase,
    BannerDatabase:BannerDatabase
}