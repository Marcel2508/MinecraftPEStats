const Databases = require("./modules/db.js");

const ApiServer = require("./modules/api.js");
const QueryTask = require("./modules/query.js");
const BannerServer = require("./modules/banner.js");
const mongo = require("mongodb").MongoClient;
const express = require("express");


const run = async function run(){
    try{
        var mongoConnection = await mongo.connect("mongodb://localhost:27017");
        //init API Database & Server class
        var apiDatabase = new Databases.ApiDatabase(mongoConnection);
        await apiDatabase.loadDatabaseStructure();
        var apiServer = new ApiServer.ApiServer({
            "port":8080,
            "mongoConnection":"mongodb://localhost:27017",
            "mongoDb":"mcstat",
            "queryInterval":360000,
            "useRouter":true,
            "databaseConnection":apiDatabase
        });
        var apiRouter = await apiServer.start();
        await apiServer.registerListener();

        var bannerDatabase = new Databases.BannerDatabase(mongoConnection);
        await bannerDatabase.loadDatabaseStructure();
        var bannerServer = new BannerServer.BannerServer({
            "port":8081,
            "mongoConnection":"mongodb://localhost:27017",
            "mongoDb":"mcstat",
            "queryInterval":360000,
            "useRouter":true,
            "databaseConnection":bannerDatabase
        });
        var bannerRouter = await bannerServer.start();
        await bannerServer.registerListener();

        var app = new express();
        app.use("/api",apiRouter);
        app.use("/banner",bannerRouter);
        app.listen(8080,()=>{
            console.log("Server running...");
        })

        /*await api.start();
        await api.registerListener();
        console.log("API STARTED!");
        await queryTask.start();
        console.log("Query Task started!")

        await bannerServer.start();
        await bannerServer.registerListener();
        console.log("BANNER-SERVICE STARTED!");*/

        console.log("SERVER ONLINE...");        

    }
    catch(ex){
        console.error("ERROR STARTING API:");
        console.error(ex);
    }
}
run();