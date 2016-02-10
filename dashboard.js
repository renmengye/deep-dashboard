Array.min = function(array) {
  return Math.min.apply(Math, array);
};

Array.max = function(array ) {
  return Math.max.apply(Math, array);
};

var Dashboard = function(rootFolder, experimentId, placeholder, options) {
    this.rootFolder = rootFolder;
    var place = d3.select(placeholder);
    if (experimentId) {
        this.addExperiment(place, experimentId);
    } else {
        d3.csv(this.rootFolder + "catalog", function(error, csvData) {
            if (error) throw error;
            // TODO: sort by last modified date.
            for (var ii = 0; 
                ii < Math.min(csvData.length, options.maxToDisplay); ++ii) {
                this.addExperiment(place, csvData[ii].id);
            }
        });
    }

    this.allPanels = {};
    this.options = options;
    this.options.xKeyFormat = "";
    if (options.xKey === "step") {
      this.xKeyFormat = ",d";
    }
};

Dashboard.prototype.addExperiment = function(placeholder, experimentId) {
    var experimentFolder = this.rootFolder + experimentId + "/";
    var dashboard = this;
    d3.csv(experimentFolder + "catalog", function(error, csvData) {
        if (error) {
            d3.select("#content")
                .append("h1")
                .html(experimentId + " Not Found");
            throw error;
        }

        var divId = "exp_" + experimentId;

        // Set title.
        placeholder
          .append("div")
          .attr("id", divId)
          .attr("class", "experiment")
          .append("h1")
          .html(experimentId + 
            " <a href='?id=" + 
            experimentId + "'> &gt;&gt;</a>");

        for (var ii = 0; ii < csvData.length; ++ii) {
            var fname = experimentFolder + csvData[ii].filename;
            var name = csvData[ii].name;
            var place = d3.select("#" + divId);
            var panel = dashboard.addPanel(place, fname, name);
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
    });
};

Dashboard.prototype.getSubsampleRate = function(len) {
    if (len < 500) {
        return 1;
    } else {
        return Math.floor(len / 500);
    }
}

Dashboard.prototype.parseData = function(csvData) {
    // Look up the data key.
    var yKey = "";
    for (var key in csvData[0]) {
        if (key !== "step" && key !== "time") {
          yKey = key;
          break;
        }
    }

    var subsample = this.getSubsampleRate(csvData.length);
    var displayValues = [];
    for (var ii = 0; ii < csvData.length; ++ii) {
        if (ii % subsample == 0) {
            displayValues.push({
                "x": csvData[ii][this.options.xKey],
                "y": csvData[ii][yKey]
            })
        }
    }

    // Assemble data.
    var data = [{
                values: displayValues,
                key: yKey
              }];
    return data;
};

Dashboard.prototype.updateChart = function(panel) {
    var chart = panel.chart;
    var dashboard = this;

    d3.csv(panel.filename, function(error, csvData) {
        if (error) throw error;
        var data = dashboard.parseData(csvData);
        var xValues = data[0].values.map(function(item) {return item.x});
        var yValues = data[0].values.map(function(item) {return item.y});
        chart
          .xDomain([Array.min(xValues), Array.max(xValues)])
          .yDomain([Array.min(yValues), Array.max(yValues)]);
        d3.select("#svg_" + panel.id)
            .datum(data);
        chart.update();
        dashboard.updateLastModified(panel, false);
    });
    setTimeout(function() {dashboard.updateChart(panel)}, this.options.timeout);
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

            // Extract y value range.
            var xValues = data[0].values.map(function(item) {return item.x});
            var yValues = data[0].values.map(function(item) {return item.y});

            // Initialize chart.
            var chart = nv.models.lineChart()
                        .options({
                          transitionDuration: 300,
                          useInteractiveGuideline: true
                        })
                        .xDomain([Array.min(xValues), Array.max(xValues)])
                        .yDomain([Array.min(yValues), Array.max(yValues)]);

            chart.xAxis
                .axisLabel(dashboard.options.xKey)
                .tickFormat(d3.format(dashboard.options.xKeyFormat));

            chart.yAxis
                .axisLabel("")
                .tickFormat(function(d) {
                  if (d == null) {
                      return "N/A";
                  }
                  return d3.format(",.2f")(d);
                });

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
        setTimeout(update, dashboard.options.timeout);
    };
    update();
};

Dashboard.prototype.getPanelId = function(filename) {
    var filenameArr = filename.split("/");
    var filename2 = filenameArr[filenameArr.length - 1];
    var filename2Arr = filename2.split(".");
    var panelId = filename2Arr[0];

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
    panelplace.append("h2").html(name);
    panel.placeholder = panelplace;
    this.allPanels[panel.id] = panel;

    return panel;
};

// Add a raw log panel.
Dashboard.prototype.addPlainLog = function(panel, timeout) {
    var dashboard = this;
    panel.placeholder.append("textarea")
                    .attr("class", "raw_log")
                    .attr("cols", "80")
                    .attr("rows", "30")
                    .attr("id", "textarea_" + panel.id)
                    .call(function() {
                        dashboard.updateLastModified(panel, true);
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
                var lines = lines.slice(Math.max(0, lines.length - 500));
                var log = lines.join("\n")
                d3.select("#textarea_" + panel.id)
                  .html(log)
                  .call(function() {
                    dashboard.updateLastModified(panel, false);
                  });

                var textarea = document.getElementById("textarea_" + panel.id);
                textarea.scrollTop = textarea.scrollHeight;

            },
            error: function(e) {throw e;}
        });
        setTimeout(update, dashboard.options.timeout);
    };
    update();
};
