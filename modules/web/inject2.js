(function(){
    //HELPER FUNCTIONS:
    //SOURCE: https://stackoverflow.com/a/6234804
    var escapeHtml = function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };
    var d0 = function d0(x){
        return x<10?"0"+x:x;
    };
    var formatDate = function formatDate(timestamp,timespan){
        var d=new Date(timestamp);
        switch(timespan.toLowerCase()){
            case "hour":
            case "day":
                return d0(d.getHours())+":"+d0(d.getMinutes());
            default:
                return d.getFullYear()+"-"+d0(d.getMonth()+1)+"-"+d0(d.getDate())+" "+d0(d.getHours())+":"+d0(d.getMinutes());
        }
    };
    
    var SERVER_ID = "%@SERVERID@%";
    var SERVER_URL = "%@SERVERURL@%";
    window.mcstats = {};
    
    var apiRequest = function apiRequest(requestUrl,_callback){
        var request = new XMLHttpRequest();
        request.open("GET",SERVER_URL+"/api/"+requestUrl);
        request.addEventListener('load', function(event) {
            if (request.status >= 200 && request.status < 300) {
                _callback(null,JSON.parse(request.responseText));
            } else {
                _callback(request.status);
            }
        });
        request.send();
    };

    var formatMinutes = function formatMinutes(minutes){
        if(minutes<60){
            return d0(minutes)+" Minutes";
        }
        else{
            var h = Math.floor(minutes/60);
            var m = minutes%60;
            return d0(h)+":"+d0(m)+" Hours";
        }
    };

    var getMaxMin = function getMaxMin(inp,min){
        var t = 0;
        for(x=0;x<inp.length;x++){
            if(!min){
                if(inp[x].playerCount>t)t=inp[x].playerCount;
            }
            else{
                if(inp[x].playerCount<t)t=inp[x].playerCount;
            }
        }
        return t;
    };

    //CALL IT LIKE: makeTable("myContainer","day",function(){..},function(){..},function(){...});
    window.mcstats.makeTable = function makeTable(target,timespan,limit,minuteFormatFunction,dateFormatFunction,_callback){
        if(!timespan)timespan="day";
        if(!dateFormatFunction)dateFormatFunction=formatDate;
        if(!minuteFormatFunction)minuteFormatFunction=formatMinutes;
        if(typeof target=="string")target=document.getElementById(target);
        if(limit===undefined||limit===null)limit=10;
        if(!target){
            console.warn("[MCSTATS] No valid DOM target specified. Please make sure to call this function after defining the target element.");
            return _callback(new Error("[MCSTATS] No valid DOM target specified. Please make sure to call this function after defining the target element."));
        }

        //get Data
        apiRequest("getPlayerMinuteCount/"+SERVER_ID+"/"+timespan,function(err,result){
            if(err){
                console.warn("[MCSTATS] Can't connect to API Server!");
                console.warn(err);
                return _callback(err);
            }
            //rendering
            target.innerHTML="";
            var table = target;
            table.classList.add("mcstats-table");
            table.classList.add("mcstats-timespan-"+escapeHtml(timespan));
            table.innerHTML= "<thead><tr><th class='mcstats-title-playername'>Playername</th><th class='mcstats-title-playedtime'>Time played</th><th class='mcstats-title-lastonline'>Last online</th></thead><tbody></tbody>";
            var tbody = table.getElementsByTagName("tbody")[0]; 
            var tbodyContentBuffer = "";
            result.playerData.forEach(function(row,i){
                if(i<limit)
                    tbodyContentBuffer+="<tr><td class='mcstats-body-playername'>"+escapeHtml(row.playerName)+"</td><td class='mcstats-body-playedtime'>"+escapeHtml(minuteFormatFunction(row.count))+"</td><td>"+escapeHtml(dateFormatFunction(row.lastOnline,timespan))+"</td></tr>";
            });
            tbody.innerHTML=tbodyContentBuffer;
            if(_callback)_callback();
        });
    };


    window.mcstats.makeChart = function makeChart(target,timespan,_callback){
        if(!timespan)timespan="day";
        if(typeof target=="string")target=document.getElementById(target);
        if(!target||!target.tagName.toLowerCase()=="svg"){
            console.warn("[MCSTATS] No valid DOM target specified. Please make sure to call this function after defining the target element.");
            return _callback(new Error("[MCSTATS] No valid DOM target specified. Please make sure to call this function after defining the target element."));
        }

        var _next = function(){
            apiRequest("getOnlineHistory/"+SERVER_ID+"/"+timespan,function(err,result){
                if(err){
                    console.warn("[MCSTATS] Can't connect to API Server!");
                    console.warn(err);
                    return _callback(err);
                }
                target.innerHTML="";
                target.classList.add("mcstats-chart");
                target.classList.add("mcstats-timespan-"+escapeHtml(timespan));
                //GENERATE CHART...
                nv.addGraph(function(){
                    var chart = nv.models.lineChart()
                    .useInteractiveGuideline(true)
                    .showLegend(true)
                    .showYAxis(true)
                    .showXAxis(true);
                    if(timespan=="day"||timespan=="hour"){
                    chart.xAxis
                        .axisLabel('Date')
                        .tickFormat(function(d) { return d3.time.format('%H:%M')(new Date(d)); });
                    }
                    else{
                        chart.xAxis
                        .axisLabel('Date')
                        .tickFormat(function(d) { return d3.time.format('%b %d')(new Date(d)); });
                    }
    
                    chart.yAxis 
                        .axisLabel("Player Count");
                    chart.forceY([getMaxMin(result.playerData,true)-2,getMaxMin(result.playerData)+2]);
                    d3.select(target)
                        .datum([
                            {
                                values:result.playerData.map(function(e){return {x:new Date(e.timestamp),y:e.playerCount};}),
                                color:"#0000FF",
                                key:"Player count"
                            }
                        ])
                        .transition().duration(500)
                        .call(chart);
                    return chart;
                });
            });
        };

        if(!(window.nv&&window.d3)){
            var s1 = document.createElement("script");
            s1.type = "text/javascript";
            s1.src = "https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.3/d3.min.js";
            var css1 = document.createElement("link");
            css1.setAttribute("href","https://cdnjs.cloudflare.com/ajax/libs/nvd3/1.8.6/nv.d3.min.css");
            css1.setAttribute("type","text/css");
            css1.setAttribute("rel","stylesheet");
            document.head.appendChild(css1);
            s1.onload=function(){
                var s2 = document.createElement("script");
                s2.type = "text/javascript";
                s2.src = "https://cdnjs.cloudflare.com/ajax/libs/nvd3/1.8.6/nv.d3.min.js";
                s2.onload=_next;
                document.head.appendChild(s2);
            };
            document.head.appendChild(s1);
        }
        else _next();
    };
})();