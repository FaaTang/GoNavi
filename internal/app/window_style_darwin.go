//go:build darwin

package app

/*
#cgo CFLAGS: -x objective-c -fblocks
#cgo LDFLAGS: -framework Cocoa
#include <stdlib.h>
#import <Cocoa/Cocoa.h>
#import <dispatch/dispatch.h>

static inline BOOL PinkHunkDBBoolYES() { return YES; }
static inline BOOL PinkHunkDBBoolNO()  { return NO; }

static char *PinkHunkDBNativeLogPath = NULL;
static BOOL PinkHunkDBNativeObserverInstalled = NO;

static void PinkHunkDBWriteNativeWindowLogLine(NSString *line) {
	if (line == nil || PinkHunkDBNativeLogPath == NULL) {
		return;
	}
	NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:[NSString stringWithUTF8String:PinkHunkDBNativeLogPath]];
	if (handle == nil) {
		return;
	}
	@try {
		[handle seekToEndOfFile];
		NSData *data = [line dataUsingEncoding:NSUTF8StringEncoding];
		[handle writeData:data];
	} @catch (__unused NSException *exception) {
	} @finally {
		[handle closeFile];
	}
}

static NSString *PinkHunkDBWindowDiagnosticLine(NSString *eventName, NSWindow *window) {
	NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
	[formatter setDateFormat:@"yyyy/MM/dd HH:mm:ss.SSSSSS"];
	NSString *timestamp = [formatter stringFromDate:[NSDate date]];
	[formatter release];
	if (window == nil) {
		return [NSString stringWithFormat:@"%@ [WARN] 原生窗口诊断：event=%@ window=nil\n", timestamp, eventName ?: @"unknown"];
	}
	NSUInteger occlusionState = 0;
	NSInteger windowNumber = [window windowNumber];
	NSInteger level = [window level];
	NSUInteger collectionBehavior = [window collectionBehavior];
	NSString *className = NSStringFromClass([window class]);
	NSString *delegateClassName = [window delegate] ? NSStringFromClass([[window delegate] class]) : @"nil";
	if (@available(macOS 10.9, *)) {
		occlusionState = [window occlusionState];
	}
	return [NSString stringWithFormat:@"%@ [WARN] 原生窗口诊断：event=%@ ptr=%p number=%ld class=%@ delegate=%@ visible=%@ miniaturized=%@ key=%@ main=%@ canHide=%@ level=%ld occlusion=%lu styleMask=%lu collectionBehavior=%lu frame=%@ screen=%@ title=%@\n",
		timestamp,
		eventName ?: @"unknown",
		window,
		(long)windowNumber,
		className ?: @"nil",
		delegateClassName,
		[window isVisible] ? @"true" : @"false",
		[window isMiniaturized] ? @"true" : @"false",
		[window isKeyWindow] ? @"true" : @"false",
		[window isMainWindow] ? @"true" : @"false",
		[window canHide] ? @"true" : @"false",
		(long)level,
		(unsigned long)occlusionState,
		(unsigned long)[window styleMask],
		(unsigned long)collectionBehavior,
		NSStringFromRect([window frame]),
		[window screen] ? NSStringFromRect([[window screen] frame]) : @"nil",
		[window title] ?: @""];
}

@interface PinkHunkDBNativeWindowObserver : NSObject
@end

@implementation PinkHunkDBNativeWindowObserver

- (void)logNotification:(NSNotification *)notification {
	NSString *name = [notification name] ?: @"unknown";
	NSWindow *window = nil;
	if ([[notification object] isKindOfClass:[NSWindow class]]) {
		window = (NSWindow *)[notification object];
	} else {
		window = [NSApp keyWindow] ?: [NSApp mainWindow];
	}
	PinkHunkDBWriteNativeWindowLogLine(PinkHunkDBWindowDiagnosticLine(name, window));
}

@end

static PinkHunkDBNativeWindowObserver *PinkHunkDBNativeWindowObserver = nil;

static void PinkHunkDBInstallNativeWindowObserver(void) {
	if (PinkHunkDBNativeObserverInstalled) {
		return;
	}
	PinkHunkDBNativeObserverInstalled = YES;
	PinkHunkDBNativeWindowObserver = [[PinkHunkDBNativeWindowObserver alloc] init];
	NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
	NSArray<NSString *> *windowNotifications = @[
		NSWindowDidBecomeKeyNotification,
		NSWindowDidResignKeyNotification,
		NSWindowDidBecomeMainNotification,
		NSWindowDidResignMainNotification,
		NSWindowDidMiniaturizeNotification,
		NSWindowDidDeminiaturizeNotification,
		NSWindowDidEnterFullScreenNotification,
		NSWindowDidExitFullScreenNotification,
		NSWindowDidMoveNotification,
		NSWindowDidResizeNotification,
		NSWindowDidChangeOcclusionStateNotification,
	];
	for (NSString *notificationName in windowNotifications) {
		[center addObserver:PinkHunkDBNativeWindowObserver selector:@selector(logNotification:) name:notificationName object:nil];
	}
	NSArray<NSString *> *appNotifications = @[
		NSApplicationDidHideNotification,
		NSApplicationDidUnhideNotification,
		NSApplicationDidBecomeActiveNotification,
		NSApplicationDidResignActiveNotification,
	];
	for (NSString *notificationName in appNotifications) {
		[center addObserver:PinkHunkDBNativeWindowObserver selector:@selector(logNotification:) name:notificationName object:nil];
	}
	for (NSWindow *window in [NSApp windows]) {
		PinkHunkDBWriteNativeWindowLogLine(PinkHunkDBWindowDiagnosticLine(@"observer:snapshot", window));
	}
}

static void PinkHunkDBConfigureNativeWindowDiagnostics(const char *logPath) {
	if (logPath == NULL || logPath[0] == '\0') {
		return;
	}
	if (PinkHunkDBNativeLogPath != NULL) {
		free(PinkHunkDBNativeLogPath);
		PinkHunkDBNativeLogPath = NULL;
	}
	PinkHunkDBNativeLogPath = strdup(logPath);
	dispatch_async(dispatch_get_main_queue(), ^{
		PinkHunkDBInstallNativeWindowObserver();
	});
}

static void PinkHunkDBSetWindowButtonsVisible(NSWindow *window, BOOL visible) {
	if (window == nil) {
		return;
	}
	for (NSWindowButton buttonType = NSWindowCloseButton; buttonType <= NSWindowZoomButton; buttonType++) {
		NSButton *button = [window standardWindowButton:buttonType];
		if (button != nil) {
			[button setHidden:!visible];
			[button setEnabled:visible];
		}
	}
}

static BOOL PinkHunkDBShouldApplyMacWindowStyle(NSWindow *window) {
	if (window == nil) {
		return NO;
	}
	NSString *className = NSStringFromClass([window class]) ?: @"";
	NSString *delegateClassName = [window delegate] ? NSStringFromClass([[window delegate] class]) : @"";
	NSString *title = [window title] ?: @"";

	// 仅对主 WailsWindow 套用原生标题栏/全屏样式，避免误伤输入法候选窗、全屏过渡窗。
	if ([className isEqualToString:@"WailsWindow"] || [delegateClassName isEqualToString:@"WindowDelegate"]) {
		return YES;
	}
	return [title isEqualToString:@"PinkHunkDB"];
}

static void PinkHunkDBApplyMacWindowStyle(BOOL enabled) {
	dispatch_async(dispatch_get_main_queue(), ^{
		for (NSWindow *window in [NSApp windows]) {
			if (window == nil) {
				continue;
			}
			if (!PinkHunkDBShouldApplyMacWindowStyle(window)) {
				PinkHunkDBWriteNativeWindowLogLine(PinkHunkDBWindowDiagnosticLine(@"style:skip-non-app-window", window));
				continue;
			}

			NSUInteger styleMask = [window styleMask];
			styleMask |= NSWindowStyleMaskClosable;
			styleMask |= NSWindowStyleMaskMiniaturizable;
			styleMask |= NSWindowStyleMaskResizable;

			if (enabled) {
				styleMask |= NSWindowStyleMaskTitled;
				styleMask |= NSWindowStyleMaskFullSizeContentView;
				[window setStyleMask:styleMask];
				[window setTitleVisibility:NSWindowTitleHidden];
				[window setTitlebarAppearsTransparent:YES];
				[window setMovableByWindowBackground:YES];
				[window setCollectionBehavior:[window collectionBehavior] | NSWindowCollectionBehaviorFullScreenPrimary];
				PinkHunkDBSetWindowButtonsVisible(window, YES);
			} else {
				styleMask &= ~NSWindowStyleMaskTitled;
				styleMask &= ~NSWindowStyleMaskFullSizeContentView;
				[window setStyleMask:styleMask];
				[window setTitleVisibility:NSWindowTitleVisible];
				[window setTitlebarAppearsTransparent:NO];
				[window setMovableByWindowBackground:YES];
				PinkHunkDBSetWindowButtonsVisible(window, NO);
			}

			[[window contentView] setNeedsDisplay:YES];
			[window invalidateShadow];
			PinkHunkDBWriteNativeWindowLogLine(PinkHunkDBWindowDiagnosticLine(enabled ? @"style:enable-native-controls" : @"style:disable-native-controls", window));
		}
	});
}
*/
import "C"

import "unsafe"

func installMacNativeWindowDiagnostics(logPath string) {
	if logPath == "" {
		return
	}
	cLogPath := C.CString(logPath)
	defer C.free(unsafe.Pointer(cLogPath))
	C.PinkHunkDBConfigureNativeWindowDiagnostics(cLogPath)
}

func setMacNativeWindowControls(enabled bool) {
	state := resolveMacNativeWindowControlState(enabled)
	if state.ShowNativeButtons {
		C.PinkHunkDBApplyMacWindowStyle(C.PinkHunkDBBoolYES())
	} else {
		C.PinkHunkDBApplyMacWindowStyle(C.PinkHunkDBBoolNO())
	}
}
