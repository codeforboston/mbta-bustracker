define(["leaflet", "jquery", "underscore", "utils", "path-utils"],
       function(L, $, _, $u, $p) {
           function samePoint(tp1, tp2) {
               return tp1.lat == tp2.lat &&
                   tp1.lon == tp2.lon;
           }

           return L.FeatureGroup.extend({
               /**
                * @param {Backbone.Model} bus
                *
                * @param {Object} [options]
                */
               initialize: function(bus, options) {
                   L.FeatureGroup.prototype.initialize.apply(this, []);
                   this.bus = bus;
                   this.options = options || {};
                   this._lastTimestamp = 0;

                   bus.on("change", this.update, this);
               },

               // Returns the bus as a dictionary of attributes.
               getBus: function() {
                   return this.bus && this.bus.attributes;
               },

               makeIcon: function(bus, rot) {
                   var route = this.bus.getRoute(),
                       routeName = route.getShortName(),
                       color = route.getColor();

                   if (routeName.match(/Red|Blue|Orange/))
                       routeName = "T";

                   var html = "<div class='bus-marker' style='transform: rotate(" + rot +
                           "rad); border-color: " + color + "; color: " + color + "'>" +
                           routeName + "</div>";

                   return L.divIcon({
                       className: "bus-marker-container",
                       iconSize: L.point(36, 24),
                       html: html
                   });
               },

               updateIcon: function(bus, rot) {
                   var busDiv = this.busMarker._icon.firstElementChild;

                   busDiv.style.transform = "rotate(" + rot + "rad)";
               },

               // Called by Leaflet when the marker is added to the map.
               onAdd: function(map) {
                   var pos = this.bus.getCurrentPosition();

                   this._map = map;
                   // this._update(bus);
                   this.busMarker = L.marker(
                       pos[0],
                       {
                           icon: this.makeIcon(this.getBus(), pos[1] - Math.PI/2)
                       });
                   this.busMarker.addTo(this);
               },


               showLRP: function() {
                   var bus = this.bus,
                       rot = bus.get("heading") - 90;

                   var center = bus.getLRP();
                   if (this._lrp) {
                       this._lrp.setLatLng(center);
                   } else {
                       var html = "<div class='lrp-arrow'>\u2192</div>";
                       var icon = L.divIcon({
                           className: "lrp-arrow-container",
                           iconSize: L.point(36, 24),
                           html: html
                       });

                       this._lrp = L.marker(center, {icon: icon})
                           .addTo(this);
                   }

                   this._lrp._icon.firstElementChild.style.transform = "rotate(" + rot + "deg)";

                   this._lrp.bindPopup("", {autoPan: false,
                                            closeOnClick: false,
                                            closeButton: false,
                                            keepInView: false})
                       .openPopup();
                   this.updateLRPText();
               },

               hideLRP: function() {
                   if (this._lrp)
                       this.removeLayer(this._lrp);
                   this._lrp = null;
               },

               updateLRPText: function() {
                   var timeSince = new Date().getTime() - this.bus.getLastUpdate().getTime();

                   this._lrp._popup.setContent(
                       ["<div class='lrp-info'>" +
                        "Last updated ", $u.relTime(timeSince/1000),
                        " ago",
                        "</div>"].join(""));
               },

               /**
                * Create and return a function for transforming a point from the
                * coordinate system of the bus to latitude and longitude.
                *
                * NOTE: currently unused!
                *
                * @param {number} rads
                * @param centerPoint
                *
                * @return {Function} A function that takes an array [x, y] and
                * returns a L.LatLng instance.
                */
               makeTransform: function(rads, center, map) {
                   var cached = this._cachedTransform;

                   if (cached && rads == cached.theta) {
                       return cached.transform;
                   }

                   var bus = this.bus,
                       centerPoint = map.project(center),
                       cx = centerPoint.x,
                       cy = centerPoint.y,
                       sinRads = Math.sin(-rads),
                       cosRads = Math.cos(-rads);

                   var transform = function(point) {
                       var x = point[0] * cosRads - point[1] * sinRads,
                           y = point[0] * sinRads + point[1] * cosRads;

                       return map.unproject(L.point(cx+x, cy+y));
                   };

                   this._cachedTransform = {
                       transform: transform,
                       theta: rads
                   };

                   return transform;
               },

               busLatLng: function() {
                   return this._position;
               },

               /**
                * Called when the Bus model changes.
                */
               update: function(bus) {
                   if (bus.changed.hasOwnProperty("_selected")) {
                       var color = this.bus.getRoute().getColor(),
                           div = this.busMarker._icon.firstElementChild;
                       if (bus.changed._selected) {
                           div.style.backgroundColor = color;
                           div.style.color = "white";
                           div.style.textShadow = "0 0 1px rgba(0, 0, 0, 0.5)";

                           this.showLRP();
                       } else {
                           div.style.backgroundColor = "white";
                           div.style.color = color;
                           div.style.textShadow = "none";

                           this.hideLRP();
                       }

                       $(this.busMarker._icon).toggleClass("selected",
                                                           bus.changed._selected);
                   }

                   if (this._lrp && (bus.changed.lat || bus.changed.lon))
                       this.showLRP();

                   // Check if the new bus's LRP is newer than the old bus's
                   // LRP; if not, ignore it.
                   if (bus.get("timestamp") <= this._lastTimestamp)
                       return;

                   this._update(bus.attributes);
               },

               /**
                * Called with the bus's attributes when the LRP has changed.
                */
               _update: function(bus) {
                   return;
                   this._lastTimestamp = bus.timestamp;
                   if (!this._position) {
                       this._position =
                           $p.calculateTimepointPosition(
                               bus.timepoints, $u.stamp()) ||
                           L.latLng(bus.lat, bus.lon);
                   }
                   if (!this._busTheta) {
                       var degs = (360-(bus.heading-90))%360;
                       this._busTheta = degs/180 * Math.PI;
                   }

                   var lastNextPoint = this._nextPoint,
                       timepoints = bus.timepoints;

                   // If there is already a next point set, slice the new
                   // timepoint array up until that point.
                   if (lastNextPoint) {
                       timepoints = $u.dropWhile(function(pt) {
                           return !samePoint(pt, lastNextPoint);
                       }, bus.timepoints);
                   }

                   this._pathCache = $p.fastTimepoints($u.stamp(),
                                                       this._position,
                                                       timepoints);

                   this._nextPoint = null;
                   if (this._findNextTimePoint(bus))
                       this._wantsUpdate = true;
               },

               /**
                * @private
                * Destructively traverses the cached array of timepoints stored
                * in _pathCache until the next point (in time) is found.  If
                * there is already a non-obsolete stored in _nextPoint, simply
                * returns that.  If there is no _nextPoint, or if it is
                * obsolete, caches several values, advances _nextPoint, and
                * returns the timepoint.
                */
               _findNextTimePoint: function(bus) {
                   var now =$u.stamp();
                   if (this._nextPoint) {
                       if (this._nextPoint.time > now)
                           return this._nextPoint;
                       this._nextPoint = null;
                   }
                   if (this._pathCache) {
                       var timepoint;
                       while ((timepoint = this._pathCache.shift())) {
                           if (timepoint.time > now)
                               break;
                       }
                       this._nextPoint = timepoint;
                       if (timepoint) {
                           var ll = L.latLng(timepoint.lat, timepoint.lon),
                               busLL = this._position ||
                                   L.latLng(bus.lat, bus.lon),
                               dt = timepoint.time - now,
                               dLat = ll.lat - busLL.lat,
                               dLng = ll.lng - busLL.lng;

                           this._latSpeed = dLat/dt;
                           this._lngSpeed = dLng/dt;
                           this._position = busLL;
                           this._busTheta = Math.atan2(dLat, dLng);
                           return this._nextPoint;
                       }
                   }

                   return null;
               },

               tick: function(dt, now) {
                   var pos = this.bus.getCurrentPosition();
                   this.busMarker.setLatLng(pos[0]);
                   this.updateIcon(this.bus.attributes, pos[1] - Math.PI/2);
                   if (this._lrp) this.updateLRPText();
                   return;

                   this._position = $p.calculateTimepointPosition(
                       bus.timepoints, $u.stamp()) || L.latLng(bus.lat, bus.long);

                   var degs = (360-(bus.heading-90))%360;
                   this._busTheta = degs/180 * Math.PI;

                   this.busMarker.setLatLng(this._position);
                   this.updateIcon(bus, -this._busTheta);
                   return;

                   if (!this._wantsUpdate) return;

                   var bus = this.getBus(),
                       point = this._findNextTimePoint(bus);

                   // Time points exhausted!
                   if (!point)
                       this._wantsUpdate = false;

                   var oldLL = this._position;
                   this._position = L.latLng(oldLL.lat+this._latSpeed*dt,
                                             oldLL.lng+this._lngSpeed*dt);
                   this.busMarker.setLatLng(this._position);
                   this.updateIcon(bus, -this._busTheta);
               }
           });
       });
