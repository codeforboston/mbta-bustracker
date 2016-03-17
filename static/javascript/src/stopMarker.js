define(["leaflet", "underscore"],
       function(L, _) {
           return L.FeatureGroup.extend({
               initialize: function(stop) {
                   L.FeatureGroup.prototype.initialize.apply(this, []);
                   this.stop = stop;
                   this.shape = L.circle(stop.getLatLng(), 10, this.style)
                       .addTo(this);
                   this.bindPopup("");
                   this.on("popupopen", this.onPopup);
               },

               style: {
                   color: "black",
                   fillColor: "white",
                   fillOpacity: 1,
                   weight: 2
               },

               onPopup: function(e) {
                   var html, stop = this.stop;
                   if (stop.isParent()) {
                       var childStops = stop.getChildren();

                       if (childStops.length > 1) {
                           html = ["Stops:"];
                           _.each(childStops, function(stop) {
                               html.push("<br/>Name: " + stop.getName());
                           });
                           e.popup.setContent(html.join(""));
                           return;
                       }
                   }

                   html = ["Stop id: ", this.stop.id,
                           "<br/> Stop Name:", this.stop.getName()].join("");
                   e.popup.setContent(html);
               }
           });
       });
