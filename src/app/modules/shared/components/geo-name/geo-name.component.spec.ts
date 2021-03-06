import { async, ComponentFixture, TestBed, flush, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { GeoNameComponent } from './geo-name.component';
import { GeoHelperService } from '../../services/geo-helper/geo-helper.service';
import { Spied, provideMock } from '../../../../core/helpers/spied';
import { of } from 'rxjs';

describe('GeoNameComponent', () => {
  let component: GeoNameComponent;
  let fixture: ComponentFixture<GeoNameComponent>;
  let geoHelperService: Spied<GeoHelperService>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [GeoNameComponent],
      providers: [GeoHelperService, provideMock(GeoHelperService)]
    });
    geoHelperService = TestBed.get(GeoHelperService);
    TestBed.compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GeoNameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display observable name from geoHelperService', fakeAsync(() => {
    const dummyname = 'dummyname';
    geoHelperService.getName.and.returnValue(of(dummyname));
    component.ngOnInit();
    flushMicrotasks();
    fixture.detectChanges();
    const htmlElement: HTMLElement = fixture.debugElement.nativeElement;
    expect(htmlElement.textContent).toBe(dummyname);
    expect(geoHelperService.getName).toHaveBeenCalled();
  }));
});
