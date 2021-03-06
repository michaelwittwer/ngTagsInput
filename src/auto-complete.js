'use strict';

/**
 * @ngdoc directive
 * @name autoComplete
 * @module ngTagsInput
 *
 * @description
 * Provides autocomplete support for the tagsInput directive.
 *
 * @param {expression} source Expression to evaluate upon changing the input content. The input value is available as
 *                            $query. The result of the expression must be a promise that eventually resolves to an
 *                            array of strings.
 * @param {number=} [debounceDelay=100] Amount of time, in milliseconds, to wait before evaluating the expression in
 *                                      the source option after the last keystroke.
 * @param {number=} [minLength=3] Minimum number of characters that must be entered before evaluating the expression
 *                                 in the source option.
 * @param {boolean=} [highlightMatchedText=true] Flag indicating that the matched text will be highlighted in the
 *                                               suggestions list.
 * @param {number=} [maxResultsToShow=10] Maximum number of results to be displayed at a time. SHIFTCODE: If -1 all results will be displayed
 * @param {boolean=} [loadOnDownArrow=false] Flag indicating that the source option will be evaluated when the down arrow
 *                                           key is pressed and the suggestion list is closed. The current input value
 *                                           is available as $query.
 * @param {boolean=} {loadOnEmpty=false} Flag indicating that the source option will be evaluated when the input content
 *                                       becomes empty. The $query variable will be passed to the expression as an empty string.
 * @param {boolean=} {loadOnFocus=false} Flag indicating that the source option will be evaluated when the input element
 *                                       gains focus. The current input value is available as $query.
 * @param {boolean=} [selectFirstMatch=true] Flag indicating that the first match will be automatically selected once
 *                                           the suggestion list is shown.
 * @param {boolean=} [autoResize=-1] SHIFTCODE: If -1 the autocomplete will grow to display all results, if the value is
 *                                   something else than -1, it must be a positive number including 0 defining the offset from
 *                                   bottom body boundery.
 */
tagsInput.directive('autoComplete', function ($document, $timeout, $sce, $q, tagsInputConfig) {
    function SuggestionList(loadFn, options, element) {
        var self = {}, debouncedLoadId, getDifference, lastPromise;

        // SHIFTCODE - START
        var autoCompleteEl;
        var scroll;
        var liHeight;

        if (options.autoResize !== -1) {
            angular.forEach(element.children(), function (child) {
                var el = angular.element(child);

                if (el.hasClass('autocomplete')) {
                    autoCompleteEl = el;
                    el.css('overflow-y', 'auto');
                    el.css('-webkit-overflow-scrolling', 'touch');
                    el.css('height', '200px');
                }
            });
        }

        scroll = function () {
            if (autoCompleteEl && liHeight) {
                var listItemY = (self.index - 1) * liHeight;
                autoCompleteEl[0].scrollTop = listItemY;
            }
        };
        // SHIFTCODE - END

        getDifference = function (array1, array2) {
            return array1.filter(function (item) {
                return !findInObjectArray(array2, item, options.tagsInput.displayProperty);
            });
        };

        self.reset = function () {
            lastPromise = null;

            self.items = [];
            self.visible = false;
            self.index = -1;
            self.selected = null;
            self.query = null;

            $timeout.cancel(debouncedLoadId);
        };

        self.show = function () {
            if (options.selectFirstMatch) {
                self.select(0);
            }
            else {
                self.selected = null;
            }

            self.visible = true;

            // SHIFTCODE reset scroll position
            $timeout(function () {
                if (autoCompleteEl) {
                    liHeight = autoCompleteEl.find('li')[0].offsetHeight;
                    autoCompleteEl[0].scrollTop = 0;
                }
            }, 0);
            // SHIFTCODE - END
        };

        self.load = function (query, tags) {
            $timeout.cancel(debouncedLoadId);
            debouncedLoadId = $timeout(function () {
                self.query = query;

                var promise = $q.when(loadFn({$query: query}));
                lastPromise = promise;

                promise.then(function (items) {
                    if (promise !== lastPromise) {
                        return;
                    }

                    items = makeObjectArray(items.data || items, options.tagsInput.displayProperty);
                    items = getDifference(items, tags);
                    // SHIFTCODE : introduce possibility to display all the results when setting the maxResultsToShow option to -1
                    if (options.maxResultsToShow === -1) {
                        self.items = items;
                    } else {
                        self.items = items.slice(0, options.maxResultsToShow);
                    }

                    if (self.items.length > 0) {
                        self.show();
                    }
                    else {
                        self.reset();
                    }
                });
            }, options.debounceDelay, false);
        };

        self.selectNext = function () {
            self.select(++self.index);
            scroll();
        };

        self.selectPrior = function () {
            self.select(--self.index);
            scroll();
        };

        self.select = function (index) {
            if (index < 0) {
                index = self.items.length - 1;
            }
            else if (index >= self.items.length) {
                index = 0;
            }
            self.index = index;
            self.selected = self.items[index];
        };

        self.reset();

        return self;
    }

    return {
        restrict: 'E',
        require: '^tagsInput',
        scope: {source: '&'},
        templateUrl: 'ngTagsInput/auto-complete.html',
        link: function (scope, element, attrs, tagsInputCtrl) {
            var hotkeys = [KEYS.enter, KEYS.tab, KEYS.escape, KEYS.up, KEYS.down],
                suggestionList, tagsInput, options, getItem, getDisplayText, shouldLoadSuggestions;

            // SHIFTCODE
            var autoCompleteEl;
            var scroll;

            tagsInputConfig.load('autoComplete', scope, attrs, {
                debounceDelay: [Number, 100],
                minLength: [Number, 3],
                highlightMatchedText: [Boolean, true],
                maxResultsToShow: [Number, 10],
                loadOnDownArrow: [Boolean, false],
                loadOnEmpty: [Boolean, false],
                loadOnFocus: [Boolean, false],
                selectFirstMatch: [Boolean, true],
                autoResize: [Number, -1]
            });

            options = scope.options;

            tagsInput = tagsInputCtrl.registerAutocomplete();
            options.tagsInput = tagsInput.getOptions();

            suggestionList = new SuggestionList(scope.source, options, element);

            getItem = function (item) {
                return item[options.tagsInput.displayProperty];
            };

            getDisplayText = function (item) {
                return safeToString(getItem(item));
            };

            shouldLoadSuggestions = function (value) {
                return value && value.length >= options.minLength || !value && options.loadOnEmpty;
            };

            scope.suggestionList = suggestionList;

            scope.addSuggestionByIndex = function (index) {
                suggestionList.select(index);
                scope.addSuggestion();
            };

            scope.addSuggestion = function () {
                var added = false;

                if (suggestionList.selected) {
                    tagsInput.addTag(suggestionList.selected);
                    suggestionList.reset();
                    tagsInput.focusInput();

                    added = true;
                }
                return added;
            };

            scope.highlight = function (item) {
                var text = getDisplayText(item);
                text = encodeHTML(text);
                if (options.highlightMatchedText) {
                    text = replaceAll(text, encodeHTML(suggestionList.query), '<em>$&</em>');
                }
                return $sce.trustAsHtml(text);
            };

            scope.track = function (item) {
                return getItem(item);
            };

            tagsInput
                .on('tag-added tag-removed invalid-tag input-blur', function () {
                    suggestionList.reset();
                })
                .on('input-change', function (value) {
                    if (shouldLoadSuggestions(value)) {
                        suggestionList.load(value, tagsInput.getTags());
                    }
                    else {
                        suggestionList.reset();
                    }
                })
                .on('input-focus', function () {
                    var value = tagsInput.getCurrentTagText();
                    if (options.loadOnFocus && shouldLoadSuggestions(value)) {
                        suggestionList.load(value, tagsInput.getTags());
                    }
                })
                .on('input-keydown', function (event) {
                    var key = event.keyCode,
                        handled = false;

                    if (hotkeys.indexOf(key) === -1) {
                        return;
                    }

                    if (suggestionList.visible) {

                        if (key === KEYS.down) {
                            // FIXME : selectNext or Prior should scroll the list, so selected item is visible
                            suggestionList.selectNext();
                            handled = true;
                        }
                        else if (key === KEYS.up) {
                            suggestionList.selectPrior();
                            handled = true;
                        }
                        else if (key === KEYS.escape) {
                            suggestionList.reset();
                            handled = true;
                        }
                        else if (key === KEYS.enter || key === KEYS.tab) {
                            handled = scope.addSuggestion();
                        }
                    }
                    else {
                        if (key === KEYS.down && scope.options.loadOnDownArrow) {
                            suggestionList.load(tagsInput.getCurrentTagText(), tagsInput.getTags());
                            handled = true;
                        }
                    }

                    if (handled) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        return false;
                    }
                });
        }
    };
});
