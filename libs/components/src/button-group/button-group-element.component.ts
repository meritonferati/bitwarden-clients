import { FocusableOption } from "@angular/cdk/a11y";
import {
  HostBinding,
  Component,
  Optional,
  Inject,
  ViewChild,
  ElementRef,
  Input,
  OnDestroy,
} from "@angular/core";
import { Subscription } from "rxjs";

import { ButtonGroupComponent } from "./button-group.component";

let nextId = 0;

@Component({
  selector: "bit-button-group-element",
  templateUrl: "./button-group-element.component.html",
})
export class ButtonGroupElementComponent implements FocusableOption, OnDestroy {
  @ViewChild("input") private inputElement: ElementRef<HTMLInputElement>;

  private subscription: Subscription;

  id = nextId++;
  selected = false;

  @Input() value?: string;

  constructor(
    @Optional() @Inject(ButtonGroupComponent) private groupComponent?: ButtonGroupComponent
  ) {
    this.subscription = groupComponent.externalSelectionChange.subscribe((value) => {
      this.selected = value === this.value;
    });
  }

  @HostBinding("tabIndex") tabIndex = "-1";
  @HostBinding("class") get classList() {
    return ["tw-group"];
  }

  get name() {
    return this.groupComponent?.name;
  }

  get inputClasses() {
    return ["tw-peer", "tw-appearance-none", "tw-outline-none"];
  }

  get labelClasses() {
    return [
      "tw-font-semibold",
      "tw-transition",
      "tw-text-center",
      "tw-border-text-muted",
      "tw-text-muted",
      "tw-border-solid",
      "tw-border-y",
      "tw-border-r",
      "tw-border-l-0",
      "group-first-of-type:tw-border-l",
      "group-first-of-type:tw-rounded-l",
      "group-last-of-type:tw-rounded-r",

      "peer-focus:tw-outline-none",
      "peer-focus:tw-ring",
      "peer-focus:tw-ring-offset-2",
      "peer-focus:tw-ring-primary-500",
      "peer-focus:tw-z-10",
      "peer-focus:tw-bg-primary-500",
      "peer-focus:tw-border-primary-500",
      "peer-focus:tw-text-contrast",

      "hover:tw-no-underline",
      "hover:tw-bg-text-muted",
      "hover:tw-border-text-muted",
      "hover:tw-text-contrast",

      "peer-checked:tw-bg-primary-500",
      "peer-checked:tw-border-primary-500",
      "peer-checked:tw-text-contrast",
    ].concat(
      this.groupComponent?.size === "small" ? ["tw-py-1", "tw-px-2"] : ["tw-py-1.5", "tw-px-3"]
    );
  }

  focus() {
    this.inputElement.nativeElement.focus();
  }

  onInputInteraction() {
    this.groupComponent?.onInputInteraction(this.value);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}