import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActionSheetController, Platform } from '@ionic/angular';
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/camera/ngx';
import { settings } from '../../../../../settings';
import { RegistrationTid } from '../../models/registrationTid.enum';
import { PictureRequestDto } from '../../../regobs-api/models';
import { DataUrlHelper } from '../../../../core/helpers/data-url.helper';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { DomSanitizer } from '@angular/platform-browser';

const DATA_URL_TAG = 'data:image/jpeg;base64,';

@Component({
  selector: 'app-add-picture-item',
  templateUrl: './add-picture-item.component.html',
  styleUrls: ['./add-picture-item.component.scss']
})
export class AddPictureItemComponent implements OnInit {

  @Input() images: PictureRequestDto[];
  @Input() registrationTid: RegistrationTid;
  @Output() imagesChange = new EventEmitter();
  @Input() title = 'REGISTRATION.ADD_IMAGES';
  @Input() pictureCommentText = 'REGISTRATION.IMAGE_DESCRIPTION';
  @Input() pictureCommentPlaceholder = 'REGISTRATION.IMAGE_DESCRIPTION_PLACEHOLDER';
  @Input() icon = 'camera';
  @Input() showIcon = true;
  @Input() iconColor = 'dark';
  @Input() onBeforeAdd: () => Promise<void> | void;

  get imagesForCurrentRegistrationTid() {
    return this.images ? this.images.filter((image) => image.RegistrationTID === this.registrationTid) : [];
  }

  constructor(
    private translateService: TranslateService,
    private camera: Camera,
    private platform: Platform,
    private webView: WebView,
    private domSanitizer: DomSanitizer,
    private actionSheetController: ActionSheetController) { }

  ngOnInit() {
  }

  async addClick() {
    if (this.onBeforeAdd !== undefined) {
      await Promise.resolve(this.onBeforeAdd());
    }
    const translations = await this.translateService.get(
      [
        'REGISTRATION.GENERAL_COMMENT.ADD_PICTURE',
        'REGISTRATION.GENERAL_COMMENT.TAKE_NEW_PHOTO',
        'REGISTRATION.GENERAL_COMMENT.CHOOSE_FROM_LIBRARY',
        'DIALOGS.CANCEL'
      ]).toPromise();
    const actionSheet = await this.actionSheetController.create({
      header: translations['REGISTRATION.GENERAL_COMMENT.ADD_PICTURE'],
      buttons: [
        {
          text: translations['REGISTRATION.GENERAL_COMMENT.TAKE_NEW_PHOTO'],
          handler: () => this.getPicture(this.camera.PictureSourceType.CAMERA),
        },
        {
          text: translations['REGISTRATION.GENERAL_COMMENT.CHOOSE_FROM_LIBRARY'],
          handler: () => this.getPicture(this.camera.PictureSourceType.PHOTOLIBRARY),
        },
        {
          text: translations['DIALOGS.CANCEL'],
          role: 'cancel'
        }
      ]
    });
    actionSheet.present();
  }

  async getPicture(sourceType: PictureSourceType) {
    if (!this.platform.is('cordova')) {
      await this.addDummyImage();
      return true;
    }
    const options: CameraOptions = {
      quality: settings.images.quality,
      destinationType: this.camera.DestinationType.FILE_URI,
      // NOTE: Base64 encode. If API supports upload image blob later,
      // this should be changed to FILE_URL and uploaded separatly
      sourceType: sourceType,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE,
      targetHeight: settings.images.size,
      targetWidth: settings.images.size,
      correctOrientation: true,
      saveToPhotoAlbum: sourceType === PictureSourceType.CAMERA,
    };
    const imageUrl = await this.camera.getPicture(options);
    this.addImage(imageUrl);
    return true;
  }

  private async addDummyImage() {
    const dummyImage = await DataUrlHelper.getDataUrlFromSrcUrl('/assets/images/dummyregobsimage.jpeg');
    this.addImage(dummyImage);
  }

  addImage(dataUrl: string) {
    this.images.push({
      PictureImageBase64: dataUrl,
      RegistrationTID: this.registrationTid
    });
    this.imagesChange.emit(this.images);
  }

  removeImage(image: PictureRequestDto) {
    const index = this.images.indexOf(image);
    if (index >= 0) {
      this.images.splice(index, 1);
      this.imagesChange.emit(this.images);
    }
  }

  isBase64Image(img: string) {
    return img && img.startsWith('data:image');
  }

  convertFileSrc(fileUrl: string) {
    return this.domSanitizer.bypassSecurityTrustUrl(
      this.webView.convertFileSrc(fileUrl));
  }
}
