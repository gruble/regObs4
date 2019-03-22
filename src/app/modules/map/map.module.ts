import { NgModule } from '@angular/core';
import { MapComponent } from './components/map/map.component';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { MapControlsComponent } from './components/map-controls/map-controls.component';
import { MapSearchComponent } from './components/map-controls/map-search/map-search.component';
import { FullscreenToggleComponent } from './components/map-controls/fullscreen-toggle/fullscreen-toggle.component';
import { GpsCenterComponent } from './components/map-controls/gps-center/gps-center.component';
import { MapCenterInfoComponent } from './components/map-center-info/map-center-info.component';
import { ModalSearchPageModule } from './pages/modal-search/modal-search.module';
import { LeafletEdgeBufferModule } from 'ngx-leaflet-edgebuffer';
import { MapImageComponent } from './components/map-image/map-image.component';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    AngularSvgIconModule,
    TranslateModule,
    RouterModule,
    LeafletModule,
    LeafletEdgeBufferModule,
    ModalSearchPageModule,
  ],
  declarations: [
    MapComponent,
    MapControlsComponent,
    MapSearchComponent,
    FullscreenToggleComponent,
    GpsCenterComponent,
    MapCenterInfoComponent,
    MapImageComponent,
  ],
  exports: [
    MapComponent,
    MapControlsComponent,
    MapSearchComponent,
    FullscreenToggleComponent,
    GpsCenterComponent,
    MapCenterInfoComponent,
    ModalSearchPageModule,
    MapImageComponent
  ]
})
export class MapModule { }
