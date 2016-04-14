from flask import Blueprint, request, abort, json, jsonify
from datetime import datetime

import bustracker as btr
import currentdata

api_routes = Blueprint("api", __name__)

@api_routes.route("/updates")
def updates():
    vehicle_ids = request.args.get("vehicles", "")
    vehicle_idlist = vehicle_ids.split(',')
    if vehicle_ids:
        vehicle_preds = currentdata.current_data.getPredsForVehicles(vehicle_idlist)
    else:
        vehicle_preds = None

    stop_ids = request.args.get("stops", "")
    stop_idlist = stop_ids.split(',')
    if stop_ids:
        stops = currentdata.current_data.getPredsForStops(stop_idlist)
    else:
        stops = None

    route_ids = request.args.get("routes", "")
    active_shapes = []
    if route_ids:
        route_idlist = route_ids.split(',')
        vehicles = currentdata.current_data.getVehiclesOnRoutes(route_idlist)
        for veh in vehicles:
            shape_id = btr.tripshapedict.get(veh.get('trip_id'), '')
            if shape_id == '': #Unscheduled trip. Try to get shape_id by matching direction and destination
                shape_id = btr.getShapeForUnschedTrip(veh.get('route_id', ''),
                                                      veh.get('direction', ''), 
                                                      veh.get('destination', ''))
            if shape_id != '':
                active_shapes.append(shape_id)
                path  = btr.shapepathdict.get(shape_id, [])
                veh['timepoints'] = btr.getAnimationPoints(path, veh.get('lat'),
                                        veh.get('lon'), veh.get('timestamp'), 6)
            else:
                veh['timepoints'] = [{'lat' : veh.get('lat'),
                                        'lon' : veh.get('lon'), 
                                        'time' :veh.get('timestamp')}]
    else:
        vehicles = []
    active_shapes = sorted(list(set(active_shapes)))

    since = request.args.get("since", "") # Timestamp in seconds
    # if since:
    #     when = long(since)
    #     vehicles = [veh for veh in vehicles if int(veh["timestamp"]) > when]
    now_stamp = long(btr.time.time())

    return jsonify(vehicles = vehicles,
                   active_shapes = active_shapes, 
                   stamp = now_stamp,
                   stops = stops,
                   vehicle_preds = vehicle_preds)

@api_routes.route("/routes")
def bus_routes():
    #the route_ids are in a reasonable order for a user to choose from
    route_ids, routeTitles = btr.getAllRoutes()
    route_names = dict([(route_id, btr.routenamesdict[route_id]) for route_id in route_ids])
    return jsonify(route_ids = route_ids, 
                   route_names = route_names)


@api_routes.route("/routeinfo")
def route_info():
    if "routes" not in request.args:
        abort(404)

    routes = request.args.get("routes", "")
    route_ids = routes.split(",")
    response = {}
    #stop_ids = []

    for route_id in route_ids:
        try:
            shape_ids = btr.routeshapedict[route_id]
            shape2path = dict([(shid, btr.shapepathdict.get(shid)) for shid in
                               shape_ids])
            paths = btr.pathReducer([btr.shapepathdict.get(shape_id) for shape_id
                                     in shape_ids])
            stop_ids = btr.routestopsdict.get(route_id)
            stops = [btr.stopinfodict.get(stop_id) for stop_id in stop_ids]
            routename = btr.routenamesdict.get(route_id)
            parent_stops = btr.getParentsForStops(stop_ids)
            response[route_id] = {
                "shape_ids": shape_ids,
                "shape2path": shape2path,
                "paths": paths,
                "stop_ids": stop_ids,
                "stops": stops,
                "routename": routename,
                "parent_stops": parent_stops
            }
        except KeyError:
            response[route_id] = None

    return jsonify(routes=response)

@api_routes.route("/locationinfo")
def location_info():
    if "lat" not in request.args or "lon" not in request.args:
        abort(401)

    lat = float(request.args.get('lat', 40))
    lon = float(request.args.get('lon', -71))
    radius = float(request.args.get('radius', 800))
    numstops = int(request.args.get('numstops', 15))

    nearby_stops = btr.getNearbyStops(lat, lon, numstops, radius)
    routeidlist = btr.getRoutesForStops([stop.get('stop_id') for stop in nearby_stops])
    parent_stops = btr.getParentsAmongStops([s['stop_id'] for s in nearby_stops])
    return jsonify(stops = nearby_stops,
                   route_ids = routeidlist, 
                   parent_stops = parent_stops)


@api_routes.route("/alerts")
def alerts():
    alerts = btr.getAllAlertsGTFS()
    return jsonify(alerts = alerts)



@api_routes.route("/rectangle")
def rectangle():
    '''
    get all stops inside a rectangle with given SW and NE corners
    '''
    try:
        swlat = float(request.args["swlat"])
        swlon = float(request.args["swlon"])
        nelat = float(request.args["nelat"])
        nelon = float(request.args["nelon"])
    except KeyError, ValueError:
        abort(401)

    stops = btr.getStopsInRectangle(swlat, swlon, nelat, nelon)
    return jsonify(stops = stops)
