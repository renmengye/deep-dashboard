# Deep Dashboard
A better visualization tool for training machine learning models.

## Introduction

Deep dashboard currently supports displaying three types of visualizations:
- Time series data, in CSV format.
- Raw plain text data
- Image data

## Installation

* Install [Apache 2](https://httpd.apache.org/docs/2.4/install.html)

For Ubuntu,
```shell
sudo apt-get install apache2
```

* Clone this repository under Apache root folder (usaully /var/www/html).
```shell
cd $ROOT
git clone https://github.com/renmengye/visu.git visualizer
mkdir results
cp -R visualizer/example results
chmod -R +777 visualizer
chmod -R +777 results
```

* Alternatively, you can create soft links in the Apache folder. Note to 
Toronto users: soft links won't work in /u/username/public_html.

* Now browse [http://localhost/visualizer?id=example](http://localhost/visualizer?id=example)

## Couple with your training program

The dashboard interacts with your training program through static files on the
disk, as long as you know how to write a plain text file or an image to the
disk, you can watch your model being trained in real time.

### File structure

- */var/www/html/*
    - *visualizer*: javascripts, css, and html.
        - *lib*
            - jquery
            - nvd3
            - d3.
        - *index.html*: Simple frontend.
        - *dashboard.js*: Main dashboard code.
        - *utils.js*: Utility functions.

    - *results*: all your experiments files
        - *catalog*: CSV file listing all the folders here.
        - *experiment_id_1*
            - *catalog*: CSV file listing all the files here.
            - *raw.log*: Plain text file to display as plain text.
            - *curve.csv*: CSV file to display as a time series curve.
            - *plot.png*: Image file to dispay as an image.
        - *experiment_id_2*
            - *catalog*
            - *raw.log*
            - *curve.csv*
            - *plot.png*

To visaulize experment_id_1, you can always go to [http://localhost/visualizer?id=experiment_id_1](http://localhost/visualizer?id=experiment_id_1)

### Frontend (javascript)

You can customize the dashboard through modifying *index.html*. The following
code is currently in *index.html* to initialie the dashboard object.

```javascript
$(function(){
    var params = getSearchParameters();
    var dashboard = new Dashboard("../results/", params.id, "#content", {
        xKey: "time",
        timeout: 5000,
        maxLines: 500,
        maxDatapoints: 500
    });
});
```

There are four arguments to initialize a new dashboard object.
- Root folder where all the experiments are stored.
- Experiment ID
- DOM selector, where to place the dashboard.
- Extra options
    - xKey: the key name for the x-axis, "step" or "time". "step" will display
    the step number, and "time" will display the absolute time.
    - timeout: automatic refresh rate, in milliseconds.
    - maxLines: maximum number of lines to display to a plain text file.
    - maxDatapoints: maximum number of data points to display in one time 
    series curve.

### Backend (your program)
Last step to hook up the dashboard is to add some lines in your training program.
