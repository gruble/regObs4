import { nSQL, DataModel } from 'nano-sql';
import { getMode } from 'cordova-plugin-nano-sqlite/lib/sqlite-adapter';
import { settings } from './settings';
import { NanoSqlTable } from './app/core/models/nanosql-table.model';
import { AppMode } from './app/core/models/app-mode.enum';

export class NanoSql {
    public static readonly TABLES = {
        OBSERVATION: {
            name: 'observation',
            instancePerAppMode: true, // Create one table for each app mode
            model: [
                { key: 'RegId', type: 'number', props: ['pk'] },
                { key: 'GeoHazardTid', type: 'number', props: ['idx'] },
                { key: '*', type: '*' },
            ]
        },
        TRIP_LOG: {
            name: 'triplog',
            model: [
                { key: 'id', type: 'int', props: ['pk', 'ai'] },
                { key: 'latitude', type: 'number' },
                { key: 'longitude', type: 'number' },
                { key: 'timestamp', type: 'number' },
                { key: 'altitude', type: 'number' },
                { key: 'speed', type: 'number' },
                { key: 'accuracy', type: 'number' },
                { key: 'heading', type: 'number' },
            ]
        },
        TRIP_LOG_ACTIVITY: {
            name: 'triplogactivity',
            model: [
                { key: 'id', type: 'int', props: ['pk', 'ai'] },
                { key: 'state', type: 'string' },
                { key: 'timestamp', type: 'number' },
            ]
        },
        WARNING: {
            name: 'warning',
            model: [
                { key: 'id', type: 'string', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        },
        WARNING_FAVOURITE: {
            name: 'warning_favourite',
            model: [
                { key: 'id', type: 'string', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        },
        OFFLINE_MAP: {
            name: 'offlinemap',
            model: [
                { key: 'name', type: 'string', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        },
        OFFLINE_MAP_TILES: {
            name: 'offlinemaptiles',
            model: [
                { key: 'id', type: 'int', props: ['pk', 'ai'] },
                { key: 'tileId', type: 'string', props: ['idx'] },
                { key: 'url', type: 'string' },
                { key: 'mapName', type: 'string' },
                { key: 'lastAccess', type: 'number' },
            ]
        },
        OFFLINE_ASSET: {
            name: 'offlineasset',
            model: [
                { key: 'id', type: 'int', props: ['pk', 'ai'] },
                { key: 'originalUrl', type: 'string', props: ['idx'] },
                { key: 'fileUrl', type: 'string' },
                { key: 'type', type: 'string' },
                { key: 'lastAccess', type: 'number' },
            ]
        },
        MAP_SERVICE: {
            name: 'mapservice',
            model: [
                { key: 'id', type: 'string', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        },
        USER_SETTINGS: {
            name: 'usersettings',
            model: [
                { key: 'id', type: 'string', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        },
        USER: {
            name: 'user',
            instancePerAppMode: true,
            model: [
                { key: 'id', type: 'string', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        },
        DATA_LOAD: {
            name: 'dataload',
            model: [
                { key: 'id', type: 'string', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        },
        REGISTRATION: {
            name: 'registration',
            instancePerAppMode: true,
            model: [
                { key: 'geoHazard', type: 'int', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        },
        REGISTRATION_SYNC: {
            name: 'registration_sync',
            instancePerAppMode: true,
            model: [
                { key: 'id', type: 'int', props: ['pk', 'ai'] },
                { key: '*', type: '*' },
            ]
        },
        LOCATION: {
            name: 'location',
            instancePerAppMode: true,
            model: [
                { key: 'Id', type: 'int', props: ['pk'] },
                { key: 'GeoHazardId', type: 'int', props: ['idx'] },
                { key: '*', type: '*' },
            ]
        },
        KDV_ELEMENTS: {
            name: 'kdvelements',
            instancePerAppMode: true,
            model: [
                { key: 'langKey', type: 'int', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        },
        OBSERVER_GROUPS: {
            name: 'groups',
            instancePerAppMode: true,
            model: [
                { key: 'Id', type: 'int', props: ['pk'] },
                { key: '*', type: '*' },
            ]
        }
    };

    static getTables(): NanoSqlTable[] {
        const result: NanoSqlTable[] = [];
        // tslint:disable-next-line:forin
        for (const tableDef in NanoSql.TABLES) {
            result.push(NanoSql.TABLES[tableDef]);
        }
        return result;
    }

    static getInstanceName(name: string, appMode: AppMode) {
        return `${name}_${appMode}`;
    }

    static init() {
        nSQL().config({
            id: settings.db.nanoSql.dbName,
            mode: getMode(),
            version: 1,
            historyMode: {
                table: 'row',
            }
        });
        // NOTE: It is also possible to implement migrations on version updates.
        // See: https://github.com/ClickSimply/Nano-SQL/issues/70
        for (const table of NanoSql.getTables()) {
            if (table.instancePerAppMode) {
                nSQL().table(NanoSql.getInstanceName(table.name, AppMode.Prod)).model(table.model);
                nSQL().table(NanoSql.getInstanceName(table.name, AppMode.Demo)).model(table.model);
                nSQL().table(NanoSql.getInstanceName(table.name, AppMode.Test)).model(table.model);
            } else {
                nSQL().table(table.name).model(table.model);
            }
        }
        return nSQL().connect();
    }

    static getInstance(name: string, appMode: AppMode) {
        return nSQL(`${name}_${appMode}`);
    }

    static dropAllTables() {
        const promises = [];
        for (const table of NanoSql.getTables()) {
            if (table.instancePerAppMode) {
                promises.push(nSQL().table(NanoSql.getInstanceName(table.name, AppMode.Prod)).query('drop').exec());
                promises.push(nSQL().table(NanoSql.getInstanceName(table.name, AppMode.Demo)).query('drop').exec());
                promises.push(nSQL().table(NanoSql.getInstanceName(table.name, AppMode.Test)).query('drop').exec());
            } else {
                promises.push(nSQL().table(table.name).query('drop').exec());
            }
        }
        return Promise.all(promises);
    }
}
