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
    // d3.csv(this.rootFolder + "catalog", function(error, csvData) {
    //     csvData.forEach(function(elem, idx, arr) {
    //         if (elem.id == experimentId) {
          
    //         }
    //     });
    // });
    this.addExperiment(place, experimentId, false);
  } else {
    d3.csv(this.rootFolder + "catalog", function(error, csvData) {
      if (error) throw error;
      // TODO: sort by last modified date.
      displen = Math.min(csvData.length, options.maxToDisplay);
      if (displen != csvData.length) {
        csvData = csvData.slice(0, displen);
      }
      csvData.reverse();
      csvData.forEach(function(elem, idx, arr) {
        setTimeout(function() {
          dashboard.addExperiment(place, elem.id, true, elem.desc);
        }, 50 * idx);
      });
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
  var absTimeFormatter = d3.time.format("%Y/%m/%d %H:%M");
  var relTimeFormatter = d3.time.format("D%d %H:%M");
  if (this.options.xKey === "step") {
    return d3.format(",d");
  } else if (this.options.xKey === "abs_time") {
    return function(d) {
      return absTimeFormatter(new Date(d));
    };
  } else if (this.options.xKey === "rel_time") {
    return function(d) {
      return relTimeFormatter(new Date(d));
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

Dashboard.prototype.addExperiment = function(placeholder, experimentId, titleOnly, subtitle) {
  var experimentFolder = this.rootFolder + experimentId + "/";
  var dashboard = this;
  d3.csv(experimentFolder + "catalog", function(error, csvData) {
    if (error) {
      d3.select("#content")
        .append("h1")
        .html("Experiment " + experimentId + " Not Found");
      throw error;
    }
    var experimentName = dashboard.getPanelId(experimentId);
    var divId = "exp_" + experimentName;
    if (typeof subtitle == 'undefined') {
      subtitle = '';
    }
    // Set title.
    placeholder
      .append("div")
      .attr("id", divId)
      .attr("class", "experiment")
      .append("h1")
      .html("<a href='?id=" + experimentId + "'> " + experimentId + "</a>")
      .append("h3")
      .html(subtitle)
      .call(function(){
        if (!titleOnly) {
        d3.select("#" + divId)
          .append("div")
          .attr("id", "menu_" + experimentName)
          .append("h2")
          .text("Navigation").call(function() {
          for (var ii = 0; ii < csvData.length; ++ii) {
            var fname = experimentFolder + csvData[ii].filename;
            var name = csvData[ii].name;
            d3.select("#menu_" + experimentName)
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
          } else if (csvData[ii].type === "plain") {
            dashboard.addPlainLog(panel);
          } else if (csvData[ii].type === "image") {
            dashboard.addImage(panel);
          } else if (csvData[ii].type === "histogram") {
            dashboard.addHistogram(panel);
          } else {
            console.log("Unknown type " + csvData[ii].type)
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
      data.push({
        values: [], 
        key: key, 
        // color: colors[col % colors.length]
      });
      col++;
    }
  }

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
    for (var yKey in yKeys) {
      if (csvData[ii][yKey] !== "") {
        count[yKey]++;
      }
    }
  }
  var subsample = {};
  for (var yKey in yKeys){
    subsample[yKey] = this.getSubsampleRate(count[yKey]);
    count[yKey] = 0;
  }

  var getXVal = function(data, xKey) {
    if (xKey === "abs_time") {
      return Date.parse(data.time);
    } else if (xKey === "rel_time") {
      return Date.parse(data.time) - time_start + offset;
    } else {
      return data[xKey];
    }
  }
  for (var ii = 0; ii < csvData.length; ++ii) {
    for (var yKey in yKeys) {
      if (csvData[ii][yKey] !== "") {
        if (count[yKey] % subsample[yKey] == 0) {
            var col = yKeys[yKey];
            data[col].values.push({
              "x": getXVal(csvData[ii], this.options.xKey), 
              "y": csvData[ii][yKey]
            });
        }
        count[yKey]++;
      }
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
    console.log(chart)
    chart.xDomain([limits[0], limits[1]]).yDomain([limits[2], limits[3]]);
    d3.select("#svg_" + panel.id).datum(data);
    chart.xAxis.axisLabel(dashboard.getXAxis(dashboard.options.xKey))
           .tickFormat(dashboard.getXKeyFormat(dashboard.options.xKey));
    if(document.getElementById("check_ylog_" + panel.id).checked) {
      chart.yScale(d3.scale.log());
    } else {
      chart.yScale(d3.scale.linear());
    }
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

Dashboard.prototype.addChart = function(panel) {
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
        .attr("id", "svg_" + panel.id)
        .append("svg")
        .datum(data)
        .call(chart)
        .call(function() {
        dashboard.updateLastModified(panel, true);
        })
        .call(function() {
          panel.placeholder.append("div")
          .attr("class", "chart_control")
          .text("y log scale")
          .append("input")
          .attr("type", "checkbox")
          .attr("id", "check_ylog_" + panel.id)
          .call(function() {
            document.getElementById("check_ylog_" + panel.id)
                .onchange = function() {
                  dashboard.updateChart(panel);
                }.bind(dashboard);
          });
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
  panelId = panelId.replace(/ /g, "_").replace(/\(/g, "_").replace(/\)/g, "_").replace(/\//g, "_").replace(/-/g, "_");
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
  // panelplace.append("h3").html(name + "   <a href=#settings>^</a>");
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

Dashboard.prototype.parseHistogram = function(data) {
  function hist(data, dmin, dmax, nbin) {
    if (typeof dmin == 'undefined') {
      dmin = Array.min(data);
    }
    if (typeof dmax == 'undefined') {
      dmax = Array.max(data) + 0.0001;
    }
    if (!nbin) {
      nbin = data.length / 100;
    }
    var bins = [];
    step = (dmax - dmin) / nbin;
    for (var ii = 0; ii < nbin; ii++) {
      bins.push({
        x: ii * step + dmin,
        y: 0
      });
    }
    function addtobin(x) {
      idx = Math.floor((x - dmin) / step);
      bins[idx].y += 1;
    }
    data.map(addtobin);
    return bins;
  }

  var series = data.split('\n');
  var dmax = 0;
  var dmin = 0;
  var keys = [];
  var values = [];
  for (var ii = 0; ii < series.length; ii++) {
    var sdata = series[ii].split(',');
    if (sdata.length > 1) {
      keys.push(sdata[0]);
      var val = [];
      for (var jj = 1; jj < sdata.length; jj++) {
        val.push(parseFloat(sdata[jj]));
      }
      values.push(val);
      if (ii == 0) {
        dmax = Array.max(val) + 0.0001;
        dmin = Array.min(val);
      } else {
        dmax = Math.max(Array.max(val) + 0.0001, dmax);
        dmin = Math.min(Array.min(val), dmin);
      }
    }
  }

  var parsed_data = [];
  var num_max = 0;
  for (var ii = 0; ii < keys.length; ii++) {
    parsed_data[ii] = {};
    parsed_data[ii].key = keys[ii];

    var bins = hist(values[ii], dmin, dmax);
    for (var jj = 0; jj < bins.length; jj++) {
      bins[jj].series = ii;
      num_max = Math.max(bins[jj].y, num_max)
    }
    parsed_data[ii].values = bins;
    parsed_data[ii].xmax = dmax;
    parsed_data[ii].xmin = dmin;
    parsed_data[ii].ymax = num_max;
    parsed_data[ii].ymin = 0;
  }
  return parsed_data;
};

Dashboard.prototype.updateHistogram = function(panel) {
  var chart = panel.chart;
  var dashboard = this;

  d3.text(panel.filename, function(error, data) {
    if (error) throw error;
    var parsed_data = dashboard.parseHistogram(data);
    // chart.xDomain([parsed_data[0].xmin, parsed_data[0].xmax])
    //      .yDomain([parsed_data[0].ymin, parsed_data[0].ymax]);
    d3.select("#svg_" + panel.id).datum(parsed_data);
    // chart.xAxis.tickFormat(d3.format(',.2f'));
    chart.update();
    dashboard.updateLastModified(panel, false);
  });
};

Dashboard.prototype.addHistogram = function(panel) {
  var dashboard = this;
  nv.addGraph(function() {

    d3.text(panel.filename, function(error, data) {
      parsed_data = dashboard.parseHistogram(data);

      var chart = nv.models.multiBarChart()
        .reduceXTicks(true)   //If 'false', every single x-axis tick label will be rendered.
        .rotateLabels(0)      //Angle to rotate x-axis labels.
        .showControls(true)   //Allow user to switch between 'Grouped' and 'Stacked' mode.
        .groupSpacing(0.1)    //Distance between each group of bars.
      ;

      chart.xAxis
        .tickFormat(d3.format(',.2f'));

      chart.yAxis
        .tickFormat(d3.format(',.2f'));

      panel.placeholder.append("div")
        .attr("id", "chart_panel_" + panel.id)
        .attr("class", "chart_panel")
        .append("svg")
        .attr("id", "svg_" + panel.id)
        // .datum(getDataToy())
        .datum(parsed_data)
        .call(chart)
        .call(function() {
        dashboard.updateLastModified(panel, true);
        }
        );
      panel.chart = chart;
      dashboard.updateHistogram(panel);
      setInterval(dashboard.schedule(
          function() {dashboard.updateHistogram(panel)}), 
        dashboard.options.timeout);
    });

  });
};

Dashboard.prototype.schedule = function(callback) {
  var dashboard = this;
  return function() {
    if (dashboard.active && dashboard.options.autoRefresh) {
      callback();
    }
  };
};
