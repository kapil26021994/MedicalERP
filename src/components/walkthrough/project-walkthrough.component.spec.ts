import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectWalkthroughComponent } from './project-walkthrough.component';

describe('ProjectWalkthroughComponent', () => {
  let component: ProjectWalkthroughComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<ProjectWalkthroughComponent>>;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectWalkthroughComponent],
      providers: [provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA]
    });
    fixture = TestBed.createComponent(ProjectWalkthroughComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('selects a step and keeps navigation within the available steps', () => {
    expect(component.currentStepData()?.id).toBe(1);

    component.prevStep();
    expect(component.selectedStep()).toBe(1);

    component.nextStep();
    expect(component.currentStepData()?.id).toBe(2);

    component.selectStep(component.steps.length);
    component.nextStep();
    expect(component.selectedStep()).toBe(component.steps.length);
    expect(component.activeView()).toBe('steps');
  });

  it('can move backwards from an intermediate walkthrough step', () => {
    component.selectStep(3);

    component.prevStep();

    expect(component.selectedStep()).toBe(2);
    expect(component.currentStepData()?.title).toBe('POS Express Terminal & Billing');
  });

  it('accepts the modal input and emits close from the modal control', () => {
    const fixture = TestBed.createComponent(ProjectWalkthroughComponent);
    fixture.componentRef.setInput('isModal', true);
    const componentWithModal = fixture.componentInstance;
    const closeSpy = vi.fn();
    componentWithModal.closeModal.subscribe(closeSpy);
    fixture.detectChanges();

    expect(componentWithModal.isModal()).toBe(true);
    const closeButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent?.includes('close')) as HTMLButtonElement | undefined;
    expect(closeButton).toBeDefined();
    closeButton?.click();
    expect(closeSpy).toHaveBeenCalledOnce();
  });

  it('switches rendered content between infographic, guided steps, and data flow', () => {
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('AdvikaERP System Workflow Infographic');

    const guidedSteps = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Guided Steps'));
    guidedSteps?.click();
    fixture.detectChanges();
    expect(component.activeView()).toBe('steps');
    expect(root.textContent).toContain(component.currentStepData()?.title);

    const dataFlow = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Data Flow'));
    dataFlow?.click();
    fixture.detectChanges();
    expect(component.activeView()).toBe('flowchart');
    expect(root.textContent).toContain('End-to-End Retail ERP Data Flow Map');

    const diagram = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Diagram'));
    diagram?.click();
    fixture.detectChanges();
    expect(component.activeView()).toBe('infographic');
  });

  it('moves through guided steps using the rendered next and previous controls', () => {
    const root: HTMLElement = fixture.nativeElement;
    Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Guided Steps'))?.click();
    fixture.detectChanges();

    const stepTwo = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('POS Express Terminal & Billing'));
    stepTwo?.click();
    fixture.detectChanges();
    expect(component.selectedStep()).toBe(2);

    const next = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Next'));
    next?.click();
    fixture.detectChanges();
    expect(component.selectedStep()).toBe(3);
    expect(root.textContent).toContain('Purchases & OCR Bill Scanning');

    const previous = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Previous'));
    previous?.click();
    fixture.detectChanges();
    expect(component.selectedStep()).toBe(2);
  });

  it('returns no step data for an unknown selected step', () => {
    component.selectedStep.set(999);

    expect(component.currentStepData()).toBeUndefined();
  });

  it('toggles image zoom state', () => {
    expect(component.isZoomed()).toBe(false);

    component.toggleZoomImage();
    expect(component.isZoomed()).toBe(true);

    component.toggleZoomImage();
    expect(component.isZoomed()).toBe(false);
  });

  it('starts the guided tour from the infographic and toggles zoom from the image', () => {
    const root: HTMLElement = fixture.nativeElement;
    const expandButton = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Expand Image'));

    expandButton?.click();
    fixture.detectChanges();
    expect(component.isZoomed()).toBe(true);
    expect(root.textContent).toContain('Reset Zoom');

    const image = root.querySelector('img[alt="AdvikaERP Full Project Walkthrough Infographic Diagram"]');
    image?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(component.isZoomed()).toBe(false);

    Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Start Step-by-Step Tour'))?.click();
    fixture.detectChanges();
    expect(component.activeView()).toBe('steps');
    expect(root.textContent).toContain(component.currentStepData()?.title);
  });

  it('emits modal closure before navigating to a module', () => {
    const closeSpy = vi.fn();
    component.closeModal.subscribe(closeSpy);

    component.navigateToModule('/inventory');

    expect(closeSpy).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/inventory']);
  });
});
