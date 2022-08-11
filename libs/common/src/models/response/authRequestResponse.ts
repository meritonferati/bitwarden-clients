import { DeviceType } from "@bitwarden/common/enums/deviceType";

import { BaseResponse } from "./baseResponse";

export class AuthRequestResponse extends BaseResponse {
  id: string;
  publicKey: string;
  requestDeviceType: DeviceType;
  requestIpAddress: string;
  key: string;
  masterPasswordHash: string;
  creationDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.publicKey = this.getResponseProperty("PublicKey");
    this.requestDeviceType = this.getResponseProperty("RequestDeviceType");
    this.requestIpAddress = this.getResponseProperty("RequestIpAddress");
    this.key = this.getResponseProperty("Key");
    this.masterPasswordHash = this.getResponseProperty("MaterPasswordHash");
    this.creationDate = this.getResponseProperty("CreationDate");
  }
}
