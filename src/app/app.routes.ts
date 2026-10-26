import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent, title: 'Dashboard · Realtime Fintech' },
  { path: 'settings', component: SettingsComponent, title: 'Settings · Realtime Fintech' },
  { path: '**', redirectTo: '' }
];
