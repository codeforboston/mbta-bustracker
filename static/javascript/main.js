require.config({
    paths: {
        "jquery": "http://code.jquery.com/jquery-1.12.0.min",
        "leaflet": "http://cdn.leafletjs.com/leaflet/v0.7.7/leaflet",
        "backbone": "lib/backbone-min",
        "underscore": "lib/lodash.core",

        "route-model": "src/model/route",
        "routes-collection": "src/collection/routes",
        "stop-model": "src/model/stop",
        "stops-collection": "src/collection/stops",
        "shape-model": "src/model/shape",
        "shapes-collection": "src/collection/shapes",
        "vehicles-collection": "src/collection/vehicles",
        "vehicle-model": "src/model/vehicle",

        "legend": "src/view/legend",
        "infobox": "src/view/infobox",

        "config": "config",
        "animation": "src/animation",
        "bus-marker": "src/busMarker",
        "stop-marker": "src/stopMarker",
        "utils": "src/utils",
        "path-utils": "src/util/paths",

        "app-state": "src/appState",
        "map": "src/map",
        "start": "start",
        "app": "app"
    },

    shim: {
        "leaflet": {
            exports: "L"
        }
    }
});

require(["start"], function(start) {
    start.init();
});
