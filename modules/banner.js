const pureImage = require("./banner/modifiedPureImage/pureimage.js");//BECAUSE MEASURETEXT is BROKEN...
const fs = require("fs");
const path = require("path");
const BannerDatabase = require("./db.js").BannerDatabase;
const WebServer = require("./api.js").WebServer;

class BannerServer extends WebServer{
    constructor(...args){
        super(...args);
        this.db=new BannerDatabase(this.config.mongoConnection,this.config.mongoDb,this.config.queryInterval);
    }
    _loadResource(filename){
        return new Promise(async (_resolve,_reject)=>{
            //TODO: STOPPED HERE YESTERDAY...
            try{
                var img = await pureImage.decodeJPEGFromStream(fs.createReadStream(path.join(__dirname,"banner",filename)));
                _resolve(img);
            }
            catch(ex){
                _reject(ex);
            }
        });
    }
    _loadFont(fontPath,fontName,fontWeight=2){
        //WONT RETURN STH IN RESOLVE...
        return new Promise(async (_resolve,_reject)=>{
            try{
                var font = pureImage.registerFont(path.join(__dirname,"banner",fontPath),fontName);
                font.load(()=>{
                    _resolve(true);
                });
            }
            catch(ex){
                _reject(ex);
            }
        });
    }
    _copyImageResource(img){
        //THIS MAKES A COPY OF AN IMAGE IN ORDER TO MODIFY (DRAW) IT..
        var nimg = pureImage.make(img.width,img.height);
        var ctx = nimg.getContext("2d");
        ctx.drawImage(img,0,0,img.width,img.height,0,0,nimg.width,nimg.height);
        return nimg;
    }
    _minecraftCodeToColor(code){
        switch(code.toLowerCase()){
            case "§0":
                return "#000000";
            case "§1":
                return "#0000AA";
            case "§2":
                return "#00AA00";
            case "§3":
                return "#00AAAA";
            case "§4":
                return "#AA0000";
            case "§5":
                return "#AA00AA";
            case "§6":
                return "#FFAA00";
            case "§7":
                return "#AAAAAA";
            case "§8":
                return "#555555";
            case "§9":
                return "#5555FF";
            case "§a":
                return "#55FF55";
            case "§b":
                return "#55FFFF";
            case "§c":
                return "#FF5555";
            case "§d":
                return "#FF55FF";
            case "§e":
                return "#FFFF55";
            case "§f":
                return "#FFFFFF";
            default:
                return "#FFFFFF";
        }
    }
    _writeString(ctx,text,x,y){
        var CHAR_SPACING = 1;//DISTANCE BETWEEN CHARS...

        var aktX=x,aktY=y;
        var charArray = text.split("");
        ctx.fillStyle="#FFFFFF";
        for(var i=0;i<charArray.length;i++){
            if(charArray[i]==="§"){
                if(i+1<charArray.length){
                    ctx.fillStyle=this._minecraftCodeToColor(charArray[i]+charArray[i+1]);
                    i++;
                }
            }
            else{
                ctx.fillText(charArray[i],aktX,aktY);
                aktX+=pureImage.measureText(ctx,charArray[i]).width+CHAR_SPACING;
            }
        }
        return aktX;
    }
    start(){
        return new Promise(async (_resolve,_reject)=>{
            try{
                await this.db.connect();
                await this.db.loadDatabaseStructure();
                await super.start();
                this.resource = await Promise.all([
                    this._loadResource("bg.jpg"),
                    this._loadResource("dot-on.jpg"),
                    this._loadResource("dot-off.jpg"),
                    this._loadFont("Minecraft.ttf","minecraft")
                ]);
                _resolve();
            }
            catch(ex){
                _reject(ex);
            }
        });
    }
    registerListener(){
        //FIXED TO THIS CLASS
        return new Promise((_resolve,_reject)=>{
            //TODO: ADD MIDDLEWARES...
            super.registerMiddleware();
            //ROUTES 
            this.app.get("/:serverId.png",this._bannerRouteIdHandler.bind(this));

            _resolve();
        });
    }
    close(){
        super.close();
        if(this.db&&this.db.isConnected()){
            this.db.close();
        }
    }
    makeBanner(ip,port,motd,status,playerCount,playerMax){
        //CREATE A COPY OF THE BACKGROUND IMAGE
        var banner = this._copyImageResource(this.resource[0]);
        var context = banner.getContext("2d");
        context.font = "22pt minecraft";
        if(status==false){
            motd = "§cServer offline...";
            playerCount="?";
            playerMax="?";
        }
        this._writeString(context,motd,10,25);
        
        var aktX = 10;
        context.font = "12pt minecraft";
        aktX = this._writeString(context,"§7IP:",aktX,50);

        context.font = "18pt minecraft";
        aktX = this._writeString(context,ip,aktX+5,50);

        context.font = "12pt minecraft";
        aktX = this._writeString(context,"§7PORT:",aktX+10,50);

        context.font = "18pt minecraft";
        aktX = this._writeString(context,port.toString(),aktX+5,50);

        var tString ="§7"+playerCount+"/"+playerMax;
        var tWidth = pureImage.measureText(context,tString).width+tString.length;
        this._writeString(context,tString,banner.width-tWidth+15,50);

        var dotToDraw =this.resource[status?1:2];
        context.drawImage(dotToDraw,0,0,dotToDraw.width,dotToDraw.height,banner.width-dotToDraw.width-10,10,dotToDraw.width,dotToDraw.height);
        
        return banner;        
    }

    async _bannerRouteIdHandler(req,res){
        try{
            var bannerData = await this.db.getBannerDataById(req.params.serverId);
            var bannerImage = this.makeBanner(bannerData.ip,bannerData.port,bannerData.motd,bannerData.status,bannerData.aktPlayerCount,bannerData.maxPlayerCount);
            res.status(200)
            .type("image/png");
            pureImage.encodePNGToStream(bannerImage,res).then(()=>{
                res.end();
            })
            .catch((ex)=>{
                console.error(ex);
            });
        }
        catch(ex){
            this._sendError(res,ex);
        }
    }

}

module.exports = {
    BannerServer:BannerServer
};