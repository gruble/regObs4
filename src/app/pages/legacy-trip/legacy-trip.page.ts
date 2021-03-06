import { Component, OnInit, NgZone, OnDestroy } from '@angular/core';
import { TripLoggerService } from '../../core/services/trip-logger/trip-logger.service';
import { Subscription } from 'rxjs';
import { CreateTripDto } from '../../modules/regobs-api/models';
import moment from 'moment';
import { NavController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { GeoHazard } from '../../core/models/geo-hazard.enum';
import { HelpModalPage } from '../../modules/registration/pages/modal-pages/help-modal/help-modal.page';
import { LoggingService } from '../../modules/shared/services/logging/logging.service';
import { LogLevel } from '../../modules/shared/services/logging/log-level.model';
import * as utils from '@nano-sql/core/lib/utilities';
import { IsEmptyHelper } from '../../core/helpers/is-empty.helper';
import { SelectOption } from '../../modules/shared/components/input/select/select-option.model';
import { GeoPositionService } from '../../core/services/geo-position/geo-position.service';
import { take } from 'rxjs/operators';
import { RegobsAuthService } from '../../modules/auth/services/regobs-auth.service';

const DEBUG_TAG = 'LegacyTripPage';

@Component({
  selector: 'app-legacy-trip',
  templateUrl: './legacy-trip.page.html',
  styleUrls: ['./legacy-trip.page.scss'],
})
export class LegacyTripPage implements OnInit, OnDestroy {

  private tripLoggerSubscription: Subscription;

  isRunning = false;
  tripDto: CreateTripDto;
  minutes: SelectOption[];
  isLoading = false;
  hasClicked = false;

  get isValid() {
    return this.tripDto.ObservationExpectedMinutes !== undefined
      && this.tripDto.TripTypeID !== undefined;
  }

  get isEmpty() {
    return IsEmptyHelper.isEmpty(this.tripDto);
  }

  constructor(
    private tripLoggerService: TripLoggerService,
    private ngZone: NgZone,
    private regobsAuthService: RegobsAuthService,
    private translateService: TranslateService,
    private geoPositionService: GeoPositionService,
    private navController: NavController,
    private modalController: ModalController,
    private loggingService: LoggingService,
  ) {
    this.tripDto = {};
  }

  ngOnInit() {
    this.setHoursToMidnight();
    this.tripLoggerSubscription = this.tripLoggerService.getLegacyTripAsObservable().subscribe((val) => {
      this.ngZone.run(() => {
        if (val) {
          this.tripDto = val.request;
          this.isRunning = true;
        } else {
          this.isRunning = false;
        }
      });
    });
  }

  private setHoursToMidnight() {
    this.minutes = [];
    for (let i = moment().get('hours'); i <= 24; i++) {
      this.minutes.push({ text: `${i}:00`, id: i * 60 });
    }
  }

  ngOnDestroy(): void {
    if (this.tripLoggerSubscription) {
      this.tripLoggerSubscription.unsubscribe();
    }
  }

  async startTrip() {
    if (!this.isValid) {
      this.hasClicked = true;
      return;
    } else {
      const loggedInUser = await this.regobsAuthService.getLoggedInUserAsPromise();
      if (loggedInUser && loggedInUser.isLoggedIn && loggedInUser.user) {
        this.isLoading = true;
        this.tripDto.ObserverGuid = loggedInUser.user.Guid;
        this.tripDto.GeoHazardID = GeoHazard.Snow;
        this.tripDto.DeviceGuid = utils.uuid();
        try {
          const currentLocation = await this.geoPositionService.currentPosition$.pipe(take(1)).toPromise();
          if (currentLocation) {
            this.tripDto.Lat = currentLocation.coords.latitude.toString();
            this.tripDto.Lng = currentLocation.coords.longitude.toString();
            this.tripLoggerService.startLegacyTrip(this.tripDto).subscribe(() => {
              this.ngZone.run(() => {
                this.isLoading = false;
                this.navController.back();
              });
            }, (error) => {
              this.loggingService.error(error, 'Error when starting trip', DEBUG_TAG);
              this.ngZone.run(() => {
                this.isLoading = false;
                this.tripLoggerService.showTripErrorMessage(true);
              });
            });
          } else {
            this.isLoading = false;
            this.tripLoggerService.showTripNoPositionErrorMessage();
          }
        } catch (error) {
          this.isLoading = false;
          this.loggingService.log('Could not get geolocation', error, LogLevel.Warning, DEBUG_TAG);
          this.tripLoggerService.showTripNoPositionErrorMessage();
        }
      }
    }
  }

  stopTrip() {
    this.tripLoggerService.stopLegacyTrip();
  }

  async showHelp() {
    const translation = await this.translateService.get('TRIP.LEGACY_HELP_TEXT').toPromise();
    const modal = await this.modalController.create({
      component: HelpModalPage,
      componentProps: {
        helpText: translation,
      },
    });
    modal.present();
  }

  clearPage() {
    this.tripDto = {};
  }
}
