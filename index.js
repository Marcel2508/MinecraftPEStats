/**
 * (c) 2018 Marcel Aust
 * This file is the main entry point for the Statistics & Banner service.
 * There are a few commandline arguments available.
 * use --help for help
 */
const argparser = require("argparse").ArgumentParser;
const parser = new argparser({
    version:"0.0.1",
    addHelp:true,
    description:"A minecraft PE statistics API & Banner service"
})

parser.addArgument(["-a","--all"],{
    help:"Start all service components"
});
parser.addArgument(["-api","--start-api"],{
    help:"Start the API-Server in single instance with another database connection"
});
parser.addArgument(["-banner","--start-banner"],{
    help:"Start the Banner-Server in single instance with another database connection"
});
parser.addArgument(["-query","--start-query"],{
    help:"Start the Query-Service in single instance with another database connection"
});
parser.addArgument(["-webserver","--start-webserver"],{
    help:"Start the Webserver-Server in single instance"
});
parser.addArgument(["-odb","--use-single-db"],{
    help:"Start the above Services with single DB instance (not compatible with clustering)"
});
parser.addArgument(["-cluster","--use-cluster"],{
    help:"Start the Banner-Server in single instance with another database connection"
});


var args = parser.parseArgs();
console.log(args)