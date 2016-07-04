Array.min = function(array) {
  return Math.min.apply(Math, array);
};

Array.max = function(array ) {
  return Math.max.apply(Math, array);
};

Date.prototype.stdTimezoneOffset = function() {
    var jan = new Date(this.getFullYear(), 0, 1);
    var jul = new Date(this.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
}

Date.prototype.dst = function() {
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
}

var Dashboard = function(rootFolder, experimentId, placeholder, options) {
    this.rootFolder = rootFolder;
    var dashboard = this;
    var place = d3.select(placeholder);
    // Default options.
    if (!options.xKey) {
        options.xKey = "step";
    }
    if (!options.maxToDisplay) {
        options.maxToDisplay = 10;
    }
    if (!options.maxLines) {
        options.maxLines = 500;
    }
    if (!options.maxDatapoints) {
        options.maxDatapoints = 500;
    }
    if (!options.autoRefresh) {
        options.autoRefresh = false;
    }

    // Add title.
    place.append("div")
         .attr("class", "title")
         .text("Deep Dashboard");

    // Add settings panel.
    place.append("div")
         .attr("id", "settings")
         .call(function() {
            d3.select("#settings")
              .append("h1")
              .text("Settings");
            d3.select("#settings")
              .append("div")
              .text("Auto-refresh: ")
              .append("input")
              .attr("type", "checkbox")
              .attr("id", "check_auto_refresh")
              .call(function() {
                document.getElementById("check_auto_refresh")
                        .onchange = dashboard.autoRefresh.bind(dashboard);

                document.getElementById("check_auto_refresh")
                        .checked = options.autoRefresh;
              });
            d3.select("#settings")
              .append("div")
              .text("Display on x-axis: ")
              .append("select")
              .attr("id", "select_xaxis")
              .call(function() {
                var opt = {}
                opt.step = d3.select("#select_xaxis")
                .append("option")
                .attr("value", "step")
                .text("step");
                opt.abs_time = d3.select("#select_xaxis")
                .append("option")
                .attr("value", "abs_time")
                .text("absolute time");
                opt.rel_time = d3.select("#select_xaxis")
                .append("option")
                .attr("value", "rel_time")
                .text("relative time");
                opt[options.xKey].attr("selected", true);
                document.getElementById("select_xaxis")
                        .onchange = dashboard.refreshChart.bind(dashboard);
            });
         });

    if (experimentId) {
        this.addExperiment(place, experimentId, false);
    } else {
        d3.csv(this.rootFolder + "catalog", function(error, csvData) {
            if (error) throw error;
            // TODO: sort by last modified date.
            for (var ii = 0; 
                ii < Math.min(csvData.length, options.maxToDisplay); ++ii) {
                dashboard.addExperiment(place, csvData[ii].id, true);
            }
        });
    }

    this.allPanels = {};
    this.options = options;

    // Set event listener.
    this.active = true;
    window.addEventListener("mousemove", function() {
        dashboard.active = true;
    }, false);
    window.addEventListener("blur", function() {
        dashboard.active = false;
    }, false);
};

Dashboard.prototype.autoRefresh = function() {
    this.options.autoRefresh = 
        document.getElementById("check_auto_refresh").checked;
}

Dashboard.prototype.getXKeyFormat = function(xKey) {
    var floatFormatter = d3.format(",.2f");
    var timeFormatter = d3.time.format("%H:%M:%S");
    if (this.options.xKey === "step") {
        return d3.format(",d");
    } else if (this.options.xKey === "abs_time" || this.options.xKey === "rel_time") {
        return function(d) {
            return timeFormatter(new Date(d));
        };
    }
};

Dashboard.prototype.getYKeyFormat = function(yKey) {
    var floatFormatter = d3.format(",.4f");
    return function(d) {
        return floatFormatter(d);
    };
};

Dashboard.prototype.getXAxis = function(xKey) {
    if (xKey === "step") {
        return "step";
    } else if (xKey === "abs_time" || xKey === "rel_time") { 
        return "time";
    }
}

Dashboard.prototype.addExperiment = function(placeholder, experimentId, titleOnly) {
    var experimentFolder = this.rootFolder + experimentId + "/";
    var dashboard = this;
    d3.csv(experimentFolder + "catalog", function(error, csvData) {
        if (error) {
            d3.select("#content")
                .append("h1")
                .html("Experiment " + experimentId + " Not Found");
            throw error;
        }

        var divId = "exp_" + experimentId;

        // Set title.
        placeholder
          .append("div")
          .attr("id", divId)
          .attr("class", "experiment")
          .append("h1")
          .html("Experiment " + experimentId + 
            " <a href='?id=" + 
            experimentId + "'> &gt;&gt;</a>")
          .call(function(){
                if (!titleOnly) {
                d3.select("#" + divId)
                  .append("div")
                  .attr("id", "menu_" + experimentId)
                  .append("h2")
                  .text("Navigation").call(function() {
                    for (var ii = 0; ii < csvData.length; ++ii) {
                        var fname = experimentFolder + csvData[ii].filename;
                        var name = csvData[ii].name;
                        d3.select("#menu_" + experimentId)
                            .append("span")
                            .html("<h3><a href=#panel_" + 
                                dashboard.getPanelId(fname) + ">" + 
                                name + "</a></h3>");
                    }
                  });
                  for (var ii = 0; ii < csvData.length; ++ii) {
                    var fname = experimentFolder + csvData[ii].filename;
                    var name = csvData[ii].name;
                    var place = d3.select("#" + divId);
                    var panel = dashboard.addPanel(place, fname, name);
                    panel.type = csvData[ii].type;

                    if (!csvData[ii].type) {
                        csvData[ii].type = "csv";
                    }
                    if (csvData[ii].type === "csv") {
                        dashboard.addChart(panel);
                    }
                    else if (csvData[ii].type === "plain") {
                        dashboard.addPlainLog(panel);
                    } else if (csvData[ii].type == "image") {
                        dashboard.addImage(panel, dashboard.options.timeout);
                    }
                  }
              }
            });


    });
};

Dashboard.prototype.getSubsampleRate = function(len) {
    if (len < this.options.maxDatapoints) {
        return 1;
    } else {
        return Math.floor(len / this.options.maxDatapoints);
    }
};

Dashboard.prototype.parseData = function(csvData) {
    // Look up the data key.
    var yKeys = {};
    var data = [];
    var col = 0;
    var colors = ["#2980b9", "#16a085", "#c0392b", "#8e44ad", "#d35400", 
    "#2c3e50", "#3d315b", "#708b75", "#011627", "#9bc53d", "#5bc0eb", "#fde74c",
    "#e55934", "#da7921"];
    for (var key in csvData[0]) {
        if (key !== "step" && key !== "time") {
            yKeys[key] = col;
            data.push({values: [], key: key, color: colors[col % colors.length]});
            col++;
        }
    }

    var subsample = this.getSubsampleRate(csvData.length);
    var displayValues = [];
    var d = new Date()
    var offset = (d.getTimezoneOffset()) * 60000;
    if (d.dst()) {
        offset += 3600000
    }
    var time_start = Date.parse(csvData[0].time);
    var count = {};
    for (var yKey in yKeys) {
        count[yKey] = 0;
    }
    for (var ii = 0; ii < csvData.length; ++ii) {
        var xVal;
        if (this.options.xKey === "abs_time") {
            xVal = Date.parse(csvData[ii].time);
        } else if (this.options.xKey === "rel_time") {
            xVal = Date.parse(csvData[ii].time) - time_start + offset;
        } else {
            xVal = csvData[ii][this.options.xKey];
        }
        for (var yKey in yKeys) {
            if (count[yKey] % subsample == 0) {
                if (csvData[ii][yKey] !== "") {
                    var col = yKeys[yKey];
                    data[col].values.push({"x": xVal, "y": csvData[ii][yKey]});
                }
            }
            count[yKey]++;
        }
    }

    return data;
};

Dashboard.prototype.getXYLimit = function(data) {
    var minX, maxX, minY, maxY;
    for (var ii = 0; ii < data.length; ++ii) {
        var xValues = data[ii].values.map(function(item) {return item.x});
        var yValues = data[ii].values.map(function(item) {return item.y});
        if (ii == 0){
            minX = Array.min(xValues);
            maxX = Array.max(xValues);
            minY = Array.min(yValues);
            maxY = Array.max(yValues);
        } else {
            minX = Math.min(minX, Array.min(xValues));
            maxX = Math.max(maxX, Array.max(xValues));
            minY = Math.min(minY, Array.min(yValues));
            maxY = Math.max(maxY, Array.max(yValues));
        }
    }
    return [minX, maxX, minY, maxY];
};

Dashboard.prototype.updateChart = function(panel) {
    var chart = panel.chart;
    var dashboard = this;

    d3.csv(panel.filename, function(error, csvData) {
        if (error) throw error;
        var data = dashboard.parseData(csvData);
        var limits = dashboard.getXYLimit(data);
        chart.xDomain([limits[0], limits[1]]).yDomain([limits[2], limits[3]]);
        d3.select("#svg_" + panel.id).datum(data);
        chart.xAxis.axisLabel(dashboard.getXAxis(dashboard.options.xKey))
                   .tickFormat(dashboard.getXKeyFormat(dashboard.options.xKey));
        chart.update();
        dashboard.updateLastModified(panel, false);
    });
};

Dashboard.prototype.refreshChart = function() {
    this.options.xKey = $( "#select_xaxis" ).val();
    for (var panelId in this.allPanels) {
        var panel = this.allPanels[panelId];
        if (panel.type === "csv") {
            this.updateChart(panel);
        }
    }
};

Dashboard.prototype.updateLastModified = function(panel, add) {
    $.ajax({
        type: "GET",
        async: true,
        timeout: 5000,
        url: panel.filename,
        dataType : "text",
        success: function(data, textStatus, request){
            var lastModified = request.getResponseHeader("Last-Modified");
            panel.lastModified = lastModified;
            if (add) {
            d3.select("#panel_" + panel.id)
              .append("div")
              .attr("id", "ts_" + panel.id)
              .attr("class", "timestamp")
              .html("Last updated: " + lastModified);
            } else {
            d3.select("#ts_" + panel.id)
              .html("Last updated: " + lastModified);
            }
        },
        error: function(e) {throw e;}
    });
};

Dashboard.prototype.addChart = function(panel, timeout) {
    var dashboard = this;
    nv.addGraph(function() {
        // Load data
        d3.csv(panel.filename, function(error, csvData) {
            if (error) throw error;
            var data = dashboard.parseData(csvData);
            var limits = dashboard.getXYLimit(data);

            // Initialize chart.
            var chart = nv.models.lineChart()
                        .options({
                          transitionDuration: 300,
                          useInteractiveGuideline: true
                        })
                        .xDomain([limits[0], limits[1]])
                        .yDomain([limits[2], limits[3]]);

            chart.xAxis
                .axisLabel(dashboard.getXAxis(dashboard.options.xKey))
                .tickFormat(dashboard.getXKeyFormat(dashboard.options.xKey));

            chart.yAxis
                .axisLabel("")
                .tickFormat(dashboard.getYKeyFormat(dashboard.options.yKey));

            panel.placeholder.append("div")
              .attr("id", "chart_panel_" + panel.id)
              .attr("class", "chart_panel")
              .append("svg")
              .attr("id", "svg_" + panel.id)
              .datum(data)
              .call(chart)
              .call(function() {
                dashboard.updateLastModified(panel, true);
              });
            panel.chart = chart;
            dashboard.updateChart(panel);
            setInterval(dashboard.schedule(
                    function() {dashboard.updateChart(panel)}), 
                dashboard.options.timeout);
        });
    });
};


Dashboard.prototype.addImage = function(panel) {
    var dashboard = this;
    panel.placeholder.append("img")
                      .attr("class", "img_log")
                      .attr("src", panel.filename)
                      .attr("id", "img_" + panel.id)
                      .call(function() {
                        dashboard.updateLastModified(panel, true);
                      });

    var update = function() {
        var date = new Date();
        var img = d3.select("#" + "img_" + panel.id)[0][0];
        img.src = panel.filename + "?ts=" + date.getTime();
        dashboard.updateLastModified(panel, false);
    };
    update();
    setInterval(dashboard.schedule(update), dashboard.options.timeout);
};

Dashboard.prototype.getPanelId = function(filename) {
    var filenameArr = filename.split("/");
    var filename2 = filenameArr[filenameArr.length - 1];
    var filename2Arr = filename2.split(".");
    var panelId = filename2Arr[0];
    panelId = panelId.replace(" ", "_").replace("(", "").replace(")", "");

    return panelId;
};

Dashboard.prototype.addPanel = function(placeholder, filename, name) {
    var panel = {};
    panel.id = this.getPanelId(filename);
    panel.filename = filename;
    panel.name = name;
    placeholder.append("div")
            .attr("id", "panel_" + panel.id)
            .attr("class", "panel");
    panelplace = d3.select("#panel_" + panel.id);
    panelplace.append("h2").html(name + "   <a href=#settings>^</a>");
    panel.placeholder = panelplace;
    this.allPanels[panel.id] = panel;

    return panel;
};

// Add a raw log panel.
Dashboard.prototype.addPlainLog = function(panel, timeout) {
    var dashboard = this;
    panel.placeholder.append("textarea")
                     .attr("class", "raw_log")
                     .attr("cols", "94")
                     .attr("rows", "20")
                     .attr("id", "textarea_" + panel.id)
                     .call(function() {
                         dashboard.updateLastModified(panel, true);
                     });

    panel.placeholder.append("div")
                     .attr("id", "check_div_" + panel.id)
                     .attr("class", "raw_log")
                     .call(function() {
                        var div = d3.select("#check_div_" + panel.id);
                        div.append("input")
                           .attr("type", "checkbox")
                           .attr("id", "check_" + panel.id)
                           .attr("checked", true);
                        div.append("label")
                           .text("Auto-scroll to bottom");
                     });

    var update = function() {
        $.ajax({
            type: "GET",
            async: true,
            timeout: 5000,
            url: panel.filename,
            dataType : "text",
            success: function(data, textStatus, request){
                var lines = data.split("\n");
                // Maximum 500 lines.
                var lines = lines.slice(
                    Math.max(0, lines.length - dashboard.options.maxLines));
                var log = lines.join("\n")
                d3.select("#textarea_" + panel.id)
                  .html(log)
                  .call(function() {
                    dashboard.updateLastModified(panel, false);
                  });


                // Scroll to bottom.
                if (document.getElementById("check_" + panel.id).checked) {
                    var textarea = document.getElementById(
                        "textarea_" + panel.id);
                    textarea.scrollTop = textarea.scrollHeight;
                }

            },
            error: function(e) {throw e;}
        });
    };
    update();
    setInterval(dashboard.schedule(update), dashboard.options.timeout);
};

Dashboard.prototype.schedule = function(callback) {
    var dashboard = this;
    return function() {
        if (dashboard.active && dashboard.options.autoRefresh) {
            callback();
        }
    };
};
