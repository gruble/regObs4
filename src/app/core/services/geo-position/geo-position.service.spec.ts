import { TestBed } from '@angular/core/testing';

import { GeoPositionService } from './geo-position.service';

xdescribe('GeoPositionService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: GeoPositionService = TestBed.get(GeoPositionService);
    expect(service).toBeTruthy();
  });
});
