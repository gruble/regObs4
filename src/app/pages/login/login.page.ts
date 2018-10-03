import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { FormGroup, Validators, FormControl, FormBuilder } from '@angular/forms';
import { LoginService } from '../../core/services/login/login.service';
import { LoggedInUser } from '../../core/services/login/logged-in-user.model';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Input } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  loginform: FormGroup;
  $loggedInUser: Observable<LoggedInUser>;
  loading: boolean;
  @ViewChild('password') password: Input;

  get loginFormUsername() {
    return this.loginform.get('username').value;
  }
  set loginFormUsername(val: string) {
    this.loginform.get('username').setValue(val);
  }
  get loginFormPassword() {
    return this.loginform.get('password').value;
  }

  constructor(private formBuilder: FormBuilder, private loginService: LoginService) { }

  ngOnInit() {
    this.loginform = this.formBuilder.group({
      username: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required]),
    });
    this.$loggedInUser = this.loginService.getLoggedUserInAsObservable().pipe(tap((val) => {
      setTimeout(() => {
        if (!this.loginFormUsername && !val.isLoggedIn && val.email) {
          this.loginFormUsername = val.email; // Setting email to last logged in email for easy login
          this.password.focus();
        }
      });
    }));
  }

  async login() {
    if (this.loginform.valid) {
      this.loading = true;
      await this.loginService.login(this.loginFormUsername, this.loginFormPassword);
      this.loading = false;
    }
  }

  isLoggedIn(loggedInUser: LoggedInUser) {
    return loggedInUser && loggedInUser.isLoggedIn;
  }

  async logout() {
    await this.loginService.logout();
  }

}