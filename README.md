# Deep Dashboard
A better visualization tool for training machine learning models.

## Introduction

## Installation

* Install [Apache 2](https://httpd.apache.org/docs/2.4/install.html)

For Ubuntu,
```
sudo apt-get install apache2
```

* Clone this repository under Apache root folder (usaully /var/www/html).
```
cd $ROOT
git clone https://github.com/renmengye/visu.git visualizer
mkdir results
cp -R visualizer/example results
chmod -R +777 visualizer
chmod -R +777 results
```
* Now browse [http://localhost/visualizer?id=example](http://localhost/visualizer?id=example)

## Couple with your training program

The dashboard interacts with your training program through static files on the
disk, as long as you know how to write a plain text file or an image to the
disk, you can watch your model being trained in real time.

Here is the file structure:

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
        - *catalog* CSV file listing all the folders here.
        - *experiment_id_1*
            - *catalog* CSV file listing all the files here.
            - *raw.log* Plain text file to display as plain text.
            - *curve.csv* CSV file to display as a time series curve.
            - *plot.png* Image file to dispay as an image.
        - *experiment_id_2*
            - *catalog*
            - *raw.log*
            - *curve.csv*
            - *plot.png*

To visaulize experment_id_1, you can always go to [http://localhost/visualizer?id=experiment_id_1](http://localhost/visualizer?id=experiment_id_1)

