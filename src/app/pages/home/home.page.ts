import { Component, AfterViewInit, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { Geolocation, Geoposition } from '@ionic-native/geolocation/ngx';
import { Platform, ToastController, NavController, Events } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { UserMarker } from '../../core/helpers/leaflet/user-marker/user-marker';
import { ObservationService } from '../../core/services/observation/observation.service';
import { ObserverSubscriber } from 'nano-sql/lib/observable';
import { OfflineTileLayer } from '../../core/helpers/leaflet/offline-tile-layer/offline-tile-layer';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  map: L.Map;
  watchSubscription: Subscription;
  userMarker: UserMarker;
  toast: HTMLIonToastElement;
  followMode = true;
  markerLayer = L.layerGroup();
  observationSubscription: ObserverSubscriber;
  markers: Array<{ id: number, marker: L.Marker }>;
  toastDismissTimeout: NodeJS.Timer;

  constructor(private platform: Platform,
    private geolocation: Geolocation,
    private observationService: ObservationService,
    private toastController: ToastController,
    private events: Events,
  ) {

    const defaultIcon = L.icon({
      iconUrl: 'leaflet/marker-icon.png',
      shadowUrl: 'leaflet/marker-shadow.png'
    });

    L.Marker.prototype.options.icon = defaultIcon;

    this.markers = [];
    // this.initLoadingToast(); // TODO: Create component instead
  }

  options: L.MapOptions = {
    layers: [
      // tslint:disable-next-line:max-line-length
      L.tileLayer('/assets/map/topo_{z}_{x}_{y}.jpg', {
        name: 'embedded', maxZoom: 9, minZoom: 1
      }),
      // tslint:disable-next-line:max-line-length
      new OfflineTileLayer('http://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=matrikkel_bakgrunn&zoom={z}&x={x}&y={y}&format=image/jpeg', {
        name: 'topo', maxZoom: 18, minZoom: 10
      }),
      this.markerLayer,
    ],
    zoom: 13,
    center: L.latLng(59.911197, 10.741059),
    attributionControl: false,
    zoomControl: false,
  };

  initLoadingToast() {
    this.platform.ready().then(() => {
      this.observationService.isLoading.subscribe(async (isLoading) => {
        if (isLoading) {
          if (this.toastDismissTimeout) {
            clearTimeout(this.toastDismissTimeout);
          }
          this.toast = await this.toastController.create({
            message: 'Laster inn observasjoner',
            position: 'bottom',
            translucent: true,
          });
          this.toast.present();
        } else if (this.toast) {
          this.toastDismissTimeout = setTimeout(() => {
            this.toast.dismiss();
          }, 3000);
        }
      });
    });
  }

  async onMapReady(map: L.Map) {
    console.log('[INFO] onMapReady home page');

    this.map = map;
    this.map.on('moveend', () => this.onMapMoved());
    this.map.on('dragstart', () => this.disableFollowMode());

    this.observationSubscription = (await this.observationService.getObservationsAsObservable())
      .filter((regObservations) => regObservations.length > 0)
      // TODO: filter only visible in map bounds?
      .subscribe((regObservations) => {
        this.addMarkersIfNotExists(regObservations);
      });
  }

  private addMarkersIfNotExists(regObservations) {
    regObservations.forEach((regObservation) => {
      const existingMarker = this.markers.find((marker) => marker.id === regObservation.RegId);
      if (!existingMarker) {
        const latLng = L.latLng(regObservation.Latitude, regObservation.Longitude);
        const marker = L.marker(latLng, {});
        marker.addTo(this.markerLayer);
        this.markers.push({ id: regObservation.RegId, marker });
      }
    });
  }

  centerMapToUser() {
    this.followMode = true;
    if (this.userMarker) {
      const currentPosition = this.userMarker.getPosition();
      this.map.panTo(L.latLng(currentPosition.coords.latitude, currentPosition.coords.longitude));
    }
  }

  private async onMapMoved() {
    console.log('map moved');
    // TODO: If user settings show observations
    // const viewBounds = this.map.getBounds();
    // const center = this.map.getCenter();
    // await this.observationService.updateObservations(center.lat, center.lng, 10000);
  }

  private disableFollowMode() {
    this.followMode = false;
  }

  ionViewDidEnter() {

    console.log('[INFO] ionViewDidEnter home page');
    this.events.subscribe('tabs:changed', (tabName: string) => {
      if (tabName === 'home') {
        this.startGeoLocationWatch();
        this.redrawMap();
      } else {
        // Stopping geolocation when map is not visible to save battery
        this.stopGeoLocationWatch();
      }
    });
  }

  private redrawMap() {
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
        setTimeout(() => {
          this.map.invalidateSize();
        }, 500);
      }
    }, 0);
  }

  private startGeoLocationWatch() {
    console.log('[INFO] Start watching location changes');
    if (this.watchSubscription === undefined || this.watchSubscription.closed) {
      this.watchSubscription = this.geolocation.watchPosition(
        { maximumAge: 60000, enableHighAccuracy: true }
      )
        .subscribe(
          (data) => this.onPositionUpdate(data),
          (error) => this.onPositionError(error)
        );
    }
  }

  private stopGeoLocationWatch() {
    console.log('[INFO] Stop watching location changes');
    if (this.watchSubscription !== undefined && !this.watchSubscription.closed) {
      this.watchSubscription.unsubscribe();
    }
  }

  private onPositionUpdate(data: Geoposition) {
    if (data.coords && this.map) {
      const latLng = L.latLng({ lat: data.coords.latitude, lng: data.coords.longitude });
      if (!this.userMarker) {
        this.userMarker = new UserMarker(this.map, data);
        this.map.panTo(latLng);
      } else {
        this.userMarker.updatePosition(data);
        if (this.followMode) {
          this.map.panTo(latLng);
        }
      }
    }
  }

  private onPositionError(error: any) {
    // TODO: Handle error
    console.log(error);
  }

  ionViewWillLeave() {
    console.log('[INFO] ionViewWillLeave home page. Unsubscribe listeners');
    this.observationSubscription.unsubscribe();
    this.stopGeoLocationWatch();
    this.events.unsubscribe('tabs:changed');
  }
}