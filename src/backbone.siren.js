Backbone.Siren = (function (_, Backbone, undefined) {
    'use strict';

    // The store
    var _store = {}
        , store = {
            add: function (model) {
                _store[model.url()] = model;
            }

            , exists: function (model) {
                return !!_store[model.url()];
            }

            , all: function () {
                return _store;
            }
        }
        , warn = function (msg) {
            if (Backbone.Siren.settings.showWarnings && console) {
                console.warn(msg);
            }
        };


    /**
     *
     * @param actionData
     * @constructor
     */
    function Action(actionData) {
        _.extend(this, actionData);
    }


    Action.prototype = {

        /**
         *
         * @param name
         * @return {*}
         */
        getFieldByName: function (name) {
            return _.find(this.fields, function (field) {
                return field.name == name;
            });
        }
    };


    /**
     *
     * @static
     * @param name
     * @return {String}
     */
    function toCamelCase(name) {
        return name.replace(/(\-[a-z])/g, function(match){return match.toUpperCase().replace('-','');});
    }


    /**
     *
     * @static
     * @param entity
     * @return {String}
     */
    function getUrl(entity) {
        var link, url;

        if (entity.href) {
            url = entity.href;
        } else if (entity.links) {
            link = entity.links.filter(function (link) {
                return !!(link.rel && link.rel.filter(function (relType) {
                    return relType == 'self';
                }).length);
            })[0];

            if (link) {
                url = link.href;
            }
        } else {
            warn('Missing href or "self" link');
            url = '';
        }

        return url;
    }


    /**
     * Access to the representation's "self" url, or its "href" if there is one.
     *
     * @return {String}
     */
    function url() {
        return getUrl(this._data);
    }


    /**
     *
     * @static
     * @param {Object} sirenObj Can be a siren entity or siren action object
     * @return {Array}
     */
    function getClassNames(sirenObj) {
        return sirenObj['class'] || [];
    }


    /**
     *
     * @static
     * @param {Array} entities
     * @param {Object} filters
     * @return {Array}
     */
    function filter(entities, filters) {
        return _.filter(entities, function (entity) {
            return hasProperties(entity, filters);
        });
    }


    /**
     *
     * @param {Backbone.Siren.Model|Backbone.Siren.Collection} bbSiren
     * @param {Object} filters
     * @return {Boolean}
     */
    function hasProperties(bbSiren, filters) {
        var _hasProperties = true;

        if (filters.className) {
            _hasProperties = bbSiren.hasClass(filters.className);
        }

        if (filters.rel) {
            _hasProperties = bbSiren.rel() == filters.rel;
        }

        return _hasProperties;
    }


    /**
     *
     * @param {Object} action
     * @param {Object} filters
     * @return {Boolean}
     */
    function actionHasProperties(action, filters) {
        var hasProperties = true;

        if (filters.className) {
            hasProperties = _hasClass(action, filters.className);
        }

        if (filters.name) {
            hasProperties = action.name == filters.name;
        }

        return hasProperties;
    }


    /**
     *
     * @static
     * @param sirenObj
     * @param className
     * @return {Boolean}
     */
    function _hasClass(sirenObj, className) {
        return _.indexOf(getClassNames(sirenObj), className) > -1;
    }


    /**
     *
     * @param className
     * @return {Boolean}
     */
    function hasClass(className) {
        return _hasClass(this._data, className);
    }


    /**
     * Accesses the "class" property of the Siren Object
     *
     * @return {Array}
     */
    function classes() {
        return getClassNames(this._data);
    }


    /**
     *
     * @param {String} rel
     * @return {Array}
     */
    function links(rel) {
        var _links = this._data.links;

        if (rel) {
            _links = _.filter(_links, function (link) {
                return _.indexOf(link.rel, rel) > -1;
            });
        }

        return _links || [];
    }


    /**
     *
     * @param {String} rel
     * @return {Array} An array of jqXhr objects.
     */
    function request(rel) {
        var self = this
        , requests = []
        , links = this.links(rel);

        _.each(links, function (link) {
            requests.push($.getJSON(link.href, function (sirenResponse) {
                self.parseEntity(sirenResponse);
            }));
        });

        return requests;
    }


    /**
     *
     * @static
     * @param sirenObj
     * @return {String}
     */
    function getRel(sirenObj) {
        var rel = sirenObj.rel;

        if (rel) {
            rel = rel[0]; // @todo, arbitrarily grabbing the first rel might be bad but I still don't understand the use case for many rels...
            rel = rel.slice(rel.lastIndexOf('/') + 1, rel.length);
        }

        return rel;
    }


    /**
     *
     * @return {String}
     */
    function rel() {
        return getRel(this._data);
    }


    /**
     *
     * @param filters
     * @return {*|Array}
     */
    function actions(filters) {
        var _actions = this._actions;

        if (filters) {
            _actions = _.filter(_actions, function (action) {
                return actionHasProperties(action, filters);
            });
        }
        return _actions;
    }


    /**
     *
     * @param {String} actionName
     * @return {Object}
     */
    function getAllByAction(actionName) {
        var values
        , action = this.getActionByName(actionName)
        , self = this;

        if (action) {
            values = {};
            _.each(action.fields, function (field) {
                if (self instanceof Backbone.Model) {
                    values[field.name] = self.get(field.name);
                } else {
                    values[field.name] = self.meta(field.name);
                }

            });
        }

        return values;
    }


    /**
     *
     * @param {String} name
     * @return {Object|undefined}
     */
    function getActionByName(name) {
        return _.find(this._actions, function (action) {
            return action.name == name;
        });
    }


    /**
     * Access to the representation's "title"
     *
     * @return {String}
     */
    function title() {
        return this._data.title;
    }


    /**
     *
     * @param {Object} options
     * @return {Array}
     */
    function parseActions(options) {
        var self = this
            , _actions = [];

        _.each(self._data.actions, function (action) {
            var bbSirenAction = new Backbone.Siren.Action(action);

            _actions.push(bbSirenAction);

            self[toCamelCase(action.name)] = function () {

                options.url = action.href;
                options.actionName = action.name;

                if (action.method) {
                    options.method = action.method;
                }

                if (action.type) {
                    options.type = action.type;
                }

                return self.save(self.getAllByAction(action.name), options);
            };
        });

        self._actions = _actions;
        return _actions;
    }


    return {
        settings: {
            showWarnings: true
        }

        , store: store
        , Action: Action


        , Model: Backbone.Model.extend({

            url: url
            , classes: classes
            , hasClass: hasClass
            , rel: rel
            , title: title
            , actions: actions
            , links: links
            , getActionByName: getActionByName
            , getAllByAction: getAllByAction
            , parseActions: parseActions
            , request: request


            /**
             *
             * @param {Object} sirenObj
             * @param {Object} options
             */
            , resolveEntities: function (sirenObj, options) {
                var self = this
                    , resolvedEntities = [];

                _.each(sirenObj.entities, function(entity) {
                    if ((entity.href && options.autoFetch == 'linked') || options.autoFetch == 'all') {
                        resolvedEntities.push(self.fetchEntity(entity, options));
                    } else {
                        resolvedEntities.push(self.addEntity(entity, options));
                    }
                });

                return $.when(resolvedEntities).done(function () {
                    self.trigger('resolve', self);
                });
            }


            /**
             * http://backbonejs.org/#Model-parse
             *
             * @param {Object} sirenObj
             */
            , parse: function (sirenObj, options) {
                this._data = sirenObj; // Stores the entire siren object in raw json
                this._entities = [];

                this.resolveEntities(sirenObj, options);
                this.parseActions(options);

                return sirenObj.properties;
            }


            /**
             * http://backbonejs.org/#Model-toJSON
             *
             * @param {Object} options
             */
            , toJSON: function () {
                var json = _.clone(this.attributes)
                    , entities = this.entities();

                _.each(entities, function (entity) {
                    json[entity.rel()] = entity;
                });

                return json;
            }


            /**
             * Filters the entity's properties and returns only sub-entities
             *
             * @return {Array}
             */
            , entities: function (filters) {
                var self = this
                    , entities = _.filter(this, function (val, name) {
                        return _.indexOf(self._entities, name) > -1;
                    });

                if (filters) {
                    entities = filter(entities, filters);
                }

                return entities;
            }


            /**
             *
             * @param {Object} entity
             */
            , fetchEntity: function (entity) {
                var self = this;

                return $.getJSON(getUrl(entity), function (resolvedEntity) {
                    self.addEntity(resolvedEntity);
                });
            }


            /**
             *
             * @param {Object} entity
             */
            , parseEntity: function (entity) {
                var bbSiren;

                if (_hasClass(entity, 'collection')) {
                    bbSiren = new Backbone.Siren.Collection(entity);
                } else if (_hasClass(entity, 'error')) {
                    // @todo how should we represent errors?
                    warn('@todo - errors');
                } else {
                    bbSiren = new Backbone.Siren.Model(entity);
                    store.add(bbSiren);
                }

                return bbSiren;
            }


            /**
             *
             * @param {Object} entity
             */
            , addEntity: function (entity) {
                var bbSiren = this.parseEntity(entity)
                , rel = bbSiren.rel();

                this.set(rel, bbSiren);
                this._entities.push(rel);

                return bbSiren;
            }


            /**
             * http://backbonejs.org/#Model-constructor
             *
             * @param {Object} attributes
             * @param {Object} options
             */
            , constructor: function (sirenObj, options) {
                options = options || {};
                options.parse = true; // Force "parse" to be called on instantiation: http://stackoverflow.com/questions/11068989/backbone-js-using-parse-without-calling-fetch/14950519#14950519

                Backbone.Model.call(this, sirenObj, options);
            }

        })


        , Collection: Backbone.Collection.extend({
            url: url
            , classes: classes
            , hasClass: hasClass
            , title: title
            , rel: rel
            , links: links
            , actions: actions
            , getActionByName: getActionByName
            , getAllByAction: getAllByAction
            , parseActions: parseActions
            , request: request


            /**
             * http://backbonejs.org/#Collection-toJSON
             *
             * @param {Object} options
             */
            , toJSON: function (options) {
                return this.map(function(model){
                    return model.toJSON(options);
                });
            }


            /**
             *
             * @param {Function|Object} arg
             * @return {Array}
             */
            , filter: function (arg) {
                if (typeof arg ==  'function') {
                    return _.filter(this, arg);
                } else {
                    return filter(this, arg);
                }
            }


            /**
             * http://backbonejs.org/#Collection-parse
             *
             * @param {Object} sirenObj
             */
            , parse: function (sirenObj, options) {
                this._data = sirenObj; // Store the entire siren object in raw json
                this._meta = sirenObj.properties || {};

                var models = [];
                _.each(sirenObj.entities, function (entity) {
                    var model = new Backbone.Siren.Model(entity);
                    models.push(model);
                    store.add(model);
                });

                this.parseActions(options);

                return models;
            }


            /**
             * Unlike Models, collections don't have attributes.
             * However, there are times we need to store "meta" data about the collection such as
             * the paging "offset".
             *
             * @param {*} prop
             * @param {*} value
             * @return {Object}
             */
            , meta: function (name) {
                return this._meta[name];
            }


            /**
             * http://backbonejs.org/#Collection-constructor
             *
             * @param {Object} attributes
             * @param {Object} options
             */
            , constructor: function (sirenObj, options) {
                options = options || {};
                options.parse = true; // Force "parse" to be called on instantiation: http://stackoverflow.com/questions/11068989/backbone-js-using-parse-without-calling-fetch/14950519#14950519

                Backbone.Collection.call(this, sirenObj, options);
            }
        })
    };
}(_, Backbone));