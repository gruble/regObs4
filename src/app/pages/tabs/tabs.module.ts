import { NgModule } from '@angular/core';
import { TabsPageRoutingModule } from './tabs.router.module';
import { TabsPage } from './tabs.page';
import { HomePageModule } from '../home/home.module';
import { TripPageModule } from '../trip/trip.module';
import { WarningListPageModule } from '../warning-list/warning-list.module';
import { ObservationListPageModule } from '../observation-list/observation-list.module';
import { SharedModule } from '../../modules/shared/shared.module';
import { CoachMarksComponent } from '../../components/coach-marks/coach-marks.component';

@NgModule({
  imports: [
    TabsPageRoutingModule,
    HomePageModule,
    TripPageModule,
    WarningListPageModule,
    ObservationListPageModule,
    SharedModule,
  ],
  declarations: [TabsPage, CoachMarksComponent]
})
export class TabsPageModule { }
