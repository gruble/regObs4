import { Injectable } from '@angular/core';
import { settings } from '../../../../settings';
import { UserSettingService } from '../user-setting/user-setting.service';
import * as moment from 'moment';
import 'moment-timezone';
import { LangKey } from '../../models/langKey';
import { nSQL } from 'nano-sql';
import { HttpClient } from '@angular/common/http';
import { NanoSql } from '../../../../nanosql';
import { map, tap, switchMap, shareReplay, take } from 'rxjs/operators';
import { GeoHazard } from '../../models/geo-hazard.enum';
import { IWarning } from './warning.interface';
import { WarningGroup } from './warning-group.model';
import { IWarningApiResult } from './warning-api-result.interface';
import { IAvalancheWarningApiResult } from './avalanche-warning-api-result.interface';
import { combineLatest, Observable, of } from 'rxjs';
import { IWarningInMapView } from './warning-in-mapview.interface';
import { IWarningGroupInMapView } from './warninggroup-in-mapview.interface';
import { DataLoadService } from '../../../modules/data-load/services/data-load.service';
import { IWarningGroup } from './warning-group.interface';
import { UserSetting } from '../../models/user-settings.model';
import { IIceWarningApiResult } from './ice-warning-api-result.interface';
import { Platform } from '@ionic/angular';
import { HTTP } from '@ionic-native/http/ngx';
import { MapService } from '../../../modules/map/services/map/map.service';
import { IMapViewAndArea } from '../../../modules/map/services/map/map-view-and-area.interface';

@Injectable({
  providedIn: 'root'
})
export class WarningService {

  private _warningsObservable: Observable<WarningGroup[]>;
  private _warningsForCurrentGeoHazardObservable: Observable<WarningGroup[]>;
  private _warningGroupInMapViewObservable: Observable<IWarningGroupInMapView>;

  get warningsObservable$() {
    return this._warningsObservable;
  }

  get warningsForCurrentGeoHazardObservable$() {
    return this._warningsForCurrentGeoHazardObservable;
  }

  get warningGroupInMapViewObservable$() {
    return this._warningGroupInMapViewObservable;
  }

  constructor(private httpClient: HttpClient,
    private userSettingService: UserSettingService,
    private mapService: MapService,
    private dataLoadService: DataLoadService,
    private platform: Platform,
    private nativeHttp: HTTP,
  ) {
    this._warningsObservable = this.getWarningsForCurrentLanguageAsObservable();
    this._warningsForCurrentGeoHazardObservable = this.getWarningsForCurrentLanguageAndCurrentGeoHazard();
    this._warningGroupInMapViewObservable = this.getWarningsForCurrentMapViewAsObservable();
  }

  private getDataLoadId(geoHazard: GeoHazard) {
    return `${NanoSql.TABLES.WARNING.name}_${geoHazard}`;
  }

  async updateWarnings() {
    console.log('[INFO][WarningService] Updating warnings by priority');
    const userSettings = await this.userSettingService.getUserSettings();
    for (const geoHazard of this.getPriority(userSettings.currentGeoHazard)) {
      await this.checkLastUpdatedAndUpdateDataIfNeeded(geoHazard);
    }
  }

  async updateWarningsForCurrentGeoHazard() {
    const userSettings = await this.userSettingService.getUserSettings();
    return this.updateWarningsForGeoHazard(userSettings.currentGeoHazard);
  }

  private async checkLastUpdatedAndUpdateDataIfNeeded(geoHazard: GeoHazard) {
    const dataLoad = await this.dataLoadService.getState(this.getDataLoadId(geoHazard));
    const lastUpdateLimit = moment().subtract(1, 'hour');
    if (!dataLoad.lastUpdated || moment(dataLoad.lastUpdated).isBefore(lastUpdateLimit)) {
      await this.updateWarningsForGeoHazard(geoHazard);
    } else {
      console.log(`[INFO][WarningService] No need to update ${geoHazard}. Last updated is:`, dataLoad.lastUpdated);
    }
  }

  updateWarningsForGeoHazard(geoHazard: GeoHazard) {
    if (geoHazard === GeoHazard.Snow) {
      return this.updateAvalancheWarnings(LangKey.no);
    } else if (geoHazard === GeoHazard.Ice) {
      return this.updateIceWarnings();
    } else {
      return this.updateFloodAndLandslideWarnings(geoHazard, LangKey.no);
    }
  }

  addToFavourite(groupId: string, geoHazard: GeoHazard) {
    const id = `${geoHazard}_${groupId}`;
    return nSQL(NanoSql.TABLES.WARNING_FAVOURITE.name)
      .query('upsert', { id, groupId, geoHazard }).exec();
  }

  removeFromFavourite(groupId: string, geoHazard: GeoHazard) {
    const id = `${geoHazard}_${groupId}`;
    return nSQL(NanoSql.TABLES.WARNING_FAVOURITE.name).query('delete')
      .where((g) => g.id === id).exec();
  }

  private getPriority(currentGeoHazard: GeoHazard) {
    if (currentGeoHazard === GeoHazard.Snow) {
      return [GeoHazard.Snow, GeoHazard.Ice, GeoHazard.Water, GeoHazard.Dirt];
    } else if (currentGeoHazard === GeoHazard.Ice) {
      return [GeoHazard.Ice, GeoHazard.Snow, GeoHazard.Water, GeoHazard.Dirt];
    } else if (currentGeoHazard === GeoHazard.Water) {
      return [GeoHazard.Water, GeoHazard.Dirt, GeoHazard.Snow, GeoHazard.Ice];
    } else if (currentGeoHazard === GeoHazard.Dirt) {
      return [GeoHazard.Dirt, GeoHazard.Water, GeoHazard.Snow, GeoHazard.Ice];
    }
  }

  private getWarningsAsObservable() {
    return nSQL().observable<IWarningGroup[]>(() => {
      return nSQL(NanoSql.TABLES.WARNING.name).query('select').emit();
    }).debounce(1000).toRxJS();
  }

  private getFavouritesAsObservable() {
    return nSQL().observable<{ groupId: string, geoHazard: GeoHazard }[]>(() => {
      return nSQL(NanoSql.TABLES.WARNING_FAVOURITE.name).query('select').emit();
    }).toRxJS();
  }

  private getWarningsForCurrentLanguageAsObservable() {
    return combineLatest(
      this.getWarningsAsObservable(),
      this.getFavouritesAsObservable()).pipe(map(([regions, favourites]) => {
        return regions.map((region) => {
          const isFavourite = !!favourites.find((x) => x.groupId === region.regionId && x.geoHazard === region.geoHazard);
          const warningGroup = new WarningGroup(region, isFavourite);
          return warningGroup;
        }).sort((a, b) => {
          if (a.key.groupName < b.key.groupName) {
            return -1;
          }
          if (a.key.groupName > b.key.groupName) {
            return 1;
          }
          // names must be equal, sort by geohazard
          return a.key.geoHazard - b.key.geoHazard;
        });
      }), shareReplay(1));
  }

  private getGeoHazardFilter(currentGeoHazard: GeoHazard) {
    const geoHazards = [currentGeoHazard];
    if (currentGeoHazard === GeoHazard.Dirt) {
      geoHazards.push(GeoHazard.Water);
    } else if (currentGeoHazard === GeoHazard.Water) {
      geoHazards.push(GeoHazard.Dirt);
    }
    return geoHazards;
  }

  private getWarningsForCurrentLanguageAndCurrentGeoHazard() {
    return combineLatest(this.getWarningsForCurrentLanguageAsObservable(),
      this.userSettingService.userSettingObservable$)
      .pipe(map(([warningGroups, userSetting]) => {
        const geoHazards = this.getGeoHazardFilter(userSetting.currentGeoHazard);
        return warningGroups.filter((wg) => geoHazards.find((g) => g === wg.key.geoHazard));
      }), shareReplay(1));
  }

  private getWarningsForCurrentMapViewAsObservable() {
    return combineLatest(this.mapService.mapViewAndAreaObservable$, this.userSettingService.userSettingObservable$)
      .pipe(switchMap(([mapViewArea, userSetting]) =>
        combineLatest(this.getWarningsForCurrentMapView(mapViewArea, userSetting))),
        map(([result]) => result),
        shareReplay(1), tap((val) => {
          console.log('[WarningForCurrentMapViewObservabe] changed: ', val);
        }));
  }

  private groupIsInRegion(warningGroup: WarningGroup, regionId: string) {
    const arr = [warningGroup.key.groupId, ...warningGroup.counties];
    return arr.indexOf(regionId) >= 0;
  }

  private isGroupInMapCenter(mapViewArea: IMapViewAndArea, warningGroup: WarningGroup, userSetting: UserSetting) {
    if (!userSetting.showMapCenter) {
      return false;
    }
    return this.groupIsInRegion(warningGroup, mapViewArea.regionInCenter);
  }

  private isGroupInViewBounds(mapViewArea: IMapViewAndArea, warningGroup: WarningGroup) {
    return mapViewArea.regionsInViewBounds.filter((region) => this.groupIsInRegion(warningGroup, region)).length > 0;
  }

  private getWarningsForCurrentMapView(mapViewArea: IMapViewAndArea, userSetting: UserSetting)
    : Observable<IWarningGroupInMapView> {
    return this.warningsForCurrentGeoHazardObservable$.pipe(
      map((warnings) => {
        // TODO: Create web worker for this processing task?
        const warningsInMapView: IWarningInMapView[] = warnings
          .map((warningGroup) => {
            const groupInMapView = {
              center: this.isGroupInMapCenter(mapViewArea, warningGroup, userSetting),
              viewBounds: this.isGroupInViewBounds(mapViewArea, warningGroup),
            };
            return { inMapView: groupInMapView, warningGroup };
          }).filter((warningGroupInView) => warningGroupInView.inMapView.center || warningGroupInView.inMapView.viewBounds);
        const warningsInCenter = warningsInMapView
          .filter((item) => item.inMapView.center)
          .map((item) => item.warningGroup);
        return {
          center: warningsInCenter,
          viewBounds: warningsInMapView.filter((item) =>
            item.inMapView.viewBounds && !item.inMapView.center
          ).map((item) => item.warningGroup)
        };
      })
    );
  }

  private async updateFloodAndLandslideWarnings(geoHazard: GeoHazard, language: LangKey, from?: Date, to?: Date) {
    console.log(`[INFO][WarningService] Updating ${GeoHazard[geoHazard]} warnings`);
    const dateRange = this.getDefaultDateRange(from, to);
    const dataLoadId = this.getDataLoadId(geoHazard);
    await this.dataLoadService.startLoading(dataLoadId);
    const url = `${this.getBaseUrl(geoHazard)}`
      + `/Warning/All/${language}`
      + `/${dateRange.from.format('YYYY-MM-DD')}`
      + `/${dateRange.to.format('YYYY-MM-DD')}`;
    const result = await this.httpClient.get<IWarningApiResult[]>(url).toPromise();
    const regions: IWarningGroup[] = [];
    for (const item of result) {
      const regionId = item.CountyList[0].Id;
      const regionName = item.CountyList[0].Name;
      const warning: IWarning = {
        language,
        mainText: item.MainText,
        validFrom: this.getDate(item.ValidFrom),
        validTo: this.getDate(item.ValidTo),
        publishTime: this.getDate(item.PublishTime),
        warningLevel: parseInt(item.ActivityLevel, 10),
      };

      const existingRegion = regions.find((r) => r.regionId === regionId);
      if (existingRegion) {
        const warningForSameDate = existingRegion.warnings
          .find((w) => moment(w.validTo).format('YYYY-MM-DD') === moment(warning.validTo).format('YYYY-MM-DD'));
        if (warningForSameDate) {
          warningForSameDate.warningLevel = Math.max(warning.warningLevel, warningForSameDate.warningLevel);
        } else {
          existingRegion.warnings.push(warning);
        }
      } else {
        regions.push({
          id: `${regionId}_${geoHazard}`,
          regionId,
          regionName,
          counties: [regionId],
          geoHazard,
          warnings: [warning],
        });
      }
    }
    console.log(`[INFO][WarningService] Result from ${GeoHazard[geoHazard]}:`, regions);
    await nSQL().loadJS(NanoSql.TABLES.WARNING.name, regions, true);

    // TODO: Delete regions no longer in result in case regions is changed in api

    await this.dataLoadService.loadingCompleted(dataLoadId, regions.length,
      dateRange.from.toDate(), new Date());
  }

  private async updateAvalancheWarnings(language: LangKey, from?: Date, to?: Date) {
    console.log(`[INFO][WarningService] Updating avalanche warnings`);
    const dateRange = this.getDefaultDateRange(from, to);
    const dataLoadId = this.getDataLoadId(GeoHazard.Snow);
    await this.dataLoadService.startLoading(dataLoadId);
    const url = `${this.getBaseUrl(GeoHazard.Snow)}`
      + `/RegionSummary/Simple/${language}`
      + `/${dateRange.from.format('YYYY-MM-DD')}`
      + `/${dateRange.to.format('YYYY-MM-DD')}`;
    const result = await this.httpClient.get<IAvalancheWarningApiResult[]>(url).toPromise();
    const regionResult: IWarningGroup[] = result.map((region) => ({
      id: `${region.Id}_${GeoHazard.Snow}`,
      regionId: region.Id.toString(),
      regionName: region.Name,
      geoHazard: GeoHazard.Snow,
      counties: [],
      warnings: region.AvalancheWarningList.map((simpleWarning) => ({
        warningLevel: parseInt(simpleWarning.DangerLevel, 10),
        publishTime: this.getDate(simpleWarning.PublishTime),
        validFrom: this.getDate(simpleWarning.ValidFrom),
        validTo: this.getDate(simpleWarning.ValidTo),
        mainText: simpleWarning.MainText,
        language,
      })),
    }));
    console.log(`[INFO][WarningService] New updates for avalanche warnings:`, regionResult);
    await nSQL().loadJS(NanoSql.TABLES.WARNING.name, regionResult, true);

    // TODO: Delete regions no longer in result in case regions is changed in api

    await this.dataLoadService.loadingCompleted(dataLoadId, regionResult.length,
      dateRange.from.toDate(), new Date());
  }

  private async updateIceWarnings() {
    console.log(`[INFO][WarningService] Updating ice warnings`);
    const geoHazard = GeoHazard.Ice;
    const dataLoadId = this.getDataLoadId(geoHazard);
    await this.dataLoadService.startLoading(dataLoadId);
    const url = this.getBaseUrl(geoHazard);
    const result = await this.getWarningsFromApi(url);
    const regionResult: IWarningGroup[] = result.forecastRegions.map((region) => ({
      id: `${region.name}_${geoHazard}`,
      regionId: region.name,
      regionName: region.name,
      counties: region.counties,
      url: region.url,
      validFrom: this.getDate(region.validFrom),
      validTo: this.getDate(region.validTo),
      geoHazard,
      warnings: []
    }));
    console.log(`[INFO][WarningService] New updates for ice warnings:`, regionResult);
    await nSQL().loadJS(NanoSql.TABLES.WARNING.name, regionResult, true);

    // TODO: Delete regions no longer in result in case regions is changed in api
    await this.dataLoadService.loadingCompleted(dataLoadId, regionResult.length);
  }

  private getWarningsFromApi(url: string) {
    if (this.platform.is('cordova') && (this.platform.is('android') || this.platform.is('ios'))) {
      return this.getWarningsFromApiNative(url);
    } else {
      return this.getWarningsFromApiWeb(url);
    }
  }

  private async getWarningsFromApiNative(url: string): Promise<IIceWarningApiResult> {
    this.nativeHttp.setDataSerializer('json');
    const result = await this.nativeHttp.get(url, {}, {
      'Content-Type': 'application/json',
    });
    if (result.status === 200) {
      return JSON.parse(result.data.trim());
    } else {
      throw Error(`Could not download warnings from: ${url}. Status: ${result.status}. Message: ${result.error}`);
    }
  }

  private getWarningsFromApiWeb(url: string): Promise<IIceWarningApiResult> {
    // NOTE: Mocking ice warnings for web because of missing CORS headers in api (just a static file)
    return Promise.resolve(require('../../../../assets/ice_forecast_regions.json'));
  }


  private getDate(dateString: string) {
    return moment.tz(dateString, settings.services.warning.timezone).toDate();
  }

  private getBaseUrl(geoHazard: GeoHazard) {
    return settings.services.warning[GeoHazard[geoHazard]].apiUrl;
  }

  private getDefaultDateRange(from?: Date, to?: Date) {
    const fromMoment = from ? moment(from) : moment().subtract(1, 'day');
    const toMoment = to ? moment(to) : moment().endOf('day').add(settings.services.warning.defaultWarningDaysAhead, 'days');
    return { from: fromMoment, to: toMoment };
  }
}
