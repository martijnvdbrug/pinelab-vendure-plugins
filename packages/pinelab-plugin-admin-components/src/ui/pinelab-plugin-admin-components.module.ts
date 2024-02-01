import { NgModule, isDevMode } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { PinelabPluginAdminComponentsComponent } from './pinelab-plugin-admin-components.component';

@NgModule({
  declarations: [PinelabPluginAdminComponentsComponent],
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: PinelabPluginAdminComponentsComponent,
        data: { breadcrumb: 'Invoices' },
      },
    ]),
  ],
})
export class PinelabPluinAdminComponentsModule {}
