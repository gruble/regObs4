import { Injectable, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { settings } from '../../../../settings';
import { UserSettingService } from '../user-setting.service';
import * as moment from 'moment';
import { LangKey } from '../../models/langKey';
import { AvalancheWarningSimple } from './avalanche-warning-simple.model';
import { HelperService } from '../helpers/helper.service';
import * as L from 'leaflet';
import { GeometryObject, Feature, Polygon } from 'geojson';
import { RegionSummary } from './region-summary.model';
import { nSQL } from 'nano-sql';
import { Observer } from 'nano-sql/lib/observable';
import { Events } from '@ionic/angular';

const warningSummaryTable = 'warningsummary';

@Injectable({
  providedIn: 'root'
})
export class WarningService {
  constructor(private httpClient: HttpClient,
    private userSettingService: UserSettingService,
    private helperService: HelperService
  ) {

  }

  init() {
    nSQL(warningSummaryTable)
      .model([
        { key: 'Id', type: 'number', props: ['pk'] },
        { key: '*', type: '*' },
      ]);
  }

  async updateAvalancheWarnings() {
    console.log('[INFO] Updating avalanche warning region summary');
    const observable = await this.getAvalancheWarningRegionSummarySimpleApi();
    const result = await observable.toPromise();
    await nSQL().loadJS(warningSummaryTable, result);
  }

  getWarningRegionSummaryAsObservable(id?: number): Observer<RegionSummary[]> {
    return nSQL().observable<RegionSummary[]>(() => {
      return nSQL(warningSummaryTable).query('select')
        .where(['Id', id ? '=' : '!=', id ? id : null]).emit();
    });
  }

  private async getAvalancheWarningRegionSummarySimpleApi(langKey?: LangKey, from?: Date, to?: Date) {
    const defaultParams = await this.getDefaultParams(langKey, from, to);
    return this.httpClient.get<Array<RegionSummary>>(
      `${settings.services.warning.Snow.apiUrl}/`
      + `RegionSummary/Simple/${defaultParams.langKey}/${defaultParams.from}/${defaultParams.to}`);
  }

  // async avalancheWarningByCoordinatesSimple(lat: number, lng: number, langKey?: LangKey, from?: Date, to?: Date)
  //   : Promise<Observable<AvalancheWarningSimple>> {
  //   const defaultParams = await this.getDefaultParams();
  //   return this.httpClient.get<AvalancheWarningSimple>(
  //     `${settings.services.warning.Snow.apiUrl}/`
  //     + `AvalancheWarningByCoordinates/Simple`
  //     + `/${lat}/${lng}/${defaultParams.langKey}/${defaultParams.from}/${defaultParams.to}`);
  // }

  // async getAvalancheWarningForCurrentMapView() {
  //   const regions = await this.helperService.getAvalancheWarningRegionsForCurrentMapView();
  //   // TODO: return api call for region
  //   return regions;
  // }

  private async getDefaultParams(langKey?: LangKey, from?: Date, to?: Date) {
    const userSettings = await this.userSettingService.getUserSettings();
    const userLangKey = LangKey[userSettings.language];
    const fromDate = from ? moment(from) : moment();
    const toDate = to ? moment(to) : moment().add(settings.services.warning.defaultWarningDaysAhead, 'days');
    const dateFormat = 'YYYY-MM-DD';
    return { langKey: langKey ? langKey : userLangKey, from: fromDate.format(dateFormat), to: toDate.format(dateFormat) };
  }
}
